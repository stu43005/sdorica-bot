import { ClientEvents, Guild } from 'discord.js';
import { Command, CommandGroup, CommandoClient, SettingProvider } from 'discord.js-commando';
import admin from "firebase-admin";

export interface GuildSettings {
	guildId: string;
	[field: string]: any;
}

const COLLECTION_NAME = 'server_config';

const GLOBAL = 'global';
const PREFIX_KEY = 'prefix';

function getCommandStatusKey(command: Command) {
	return `cmd-${command.name}`;
}

function getGroupStatusKey(group: CommandGroup) {
	return `grp-${group.id}`;
}

/**
 * Uses an Firestore collection to store settings with guilds
 * @extends {SettingProvider}
 */
export class FirestoreProvider extends SettingProvider {
	/**
	 * Client that the provider is for (set once the client is ready, after using {@link CommandoClient#setProvider})
	 * @readonly
	 */
	private client!: CommandoClient;

	/**
	 * Database that will be used for storing/retrieving settings
	 */
	private db: admin.firestore.Firestore;

	/**
	 * Settings cached in memory, mapped by guild ID (or 'global')
	 */
	private settings: Map<string, GuildSettings>;

	/**
	 * Listeners on the Client, mapped by the event name
	 */
	private listeners: Map<keyof ClientEvents, (...args: any[]) => void>;

	/**
	 * @param {admin.app.App} app - Application from Firebase Admin
	 */
	constructor(app: admin.app.App) {
		super();

		this.db = app.firestore();
		this.settings = new Map();
		this.listeners = new Map();
	}

	async init(client: CommandoClient) {
		this.client = client;

		// Load or create the settings collection
		const collection = this.db.collection(COLLECTION_NAME);

		// Load all settings
		const docs = await collection.get();
		docs.forEach(doc => {
			const data = doc.data() as GuildSettings;

			const guildId = data.guildId;
			this.settings.set(guildId, data);

			// Guild is not global, and doesn't exist currently so lets skip it.
			if (guildId !== GLOBAL && !client.guilds.cache.has(data.guildId)) return;

			this.setupGuild(guildId, data);
		});

		// Listen for changes
		this.listeners
			.set('commandPrefixChange', (guild: Guild, prefix: string) => this.set(guild, PREFIX_KEY, prefix))
			.set('commandStatusChange', (guild: Guild, command: Command, enabled: boolean) => this.set(guild, getCommandStatusKey(command), enabled))
			.set('groupStatusChange', (guild: Guild, group: CommandGroup, enabled: boolean) => this.set(guild, getGroupStatusKey(group), enabled))
			.set('guildCreate', (guild: Guild) => {
				const settings = this.settings.get(guild.id);
				if (!settings) return;
				this.setupGuild(guild.id, settings);
			})
			.set('commandRegister', (command: Command) => {
				for (const [guild, settings] of this.settings) {
					if (guild !== GLOBAL && !client.guilds.cache.has(guild)) continue;
					this.setupGuildCommand(guild, command, settings);
				}
			})
			.set('groupRegister', (group: CommandGroup) => {
				for (const [guild, settings] of this.settings) {
					if (guild !== GLOBAL && !client.guilds.cache.has(guild)) continue;
					this.setupGuildGroup(guild, group, settings);
				}
			});
		for (const [event, listener] of this.listeners) client.on(event, listener);
	}

	async destroy() {
		// Remove all listeners from the client
		for (const [event, listener] of this.listeners) this.client.removeListener(event, listener);
		this.listeners.clear();
	}

	get(guild: string | Guild, key: string, defVal?: any) {
		const settings = this.settings.get(FirestoreProvider.getGuildID(guild));
		return settings ? typeof settings[key] !== 'undefined' ? settings[key] : defVal : defVal;
	}

	async set(guild: string | Guild, key: string, val: any) {
		const guildId = FirestoreProvider.getGuildID(guild);
		let settings = this.settings.get(guildId);
		if (!settings) {
			settings = {
				guildId
			};
			this.settings.set(guildId, settings);
		}

		settings[key] = val;

		await this.updateGuild(guildId, settings);

		if (guildId === GLOBAL) this.updateOtherShards(key, val);
		return val;
	}

	async remove(guild: string | Guild, key: string) {
		const guildId = FirestoreProvider.getGuildID(guild);
		const settings = this.settings.get(guildId);
		if (!settings || typeof settings[key] === 'undefined') return;

		const val = settings[key];
		delete settings[key];

		await this.updateGuild(guildId, settings);

		if (guildId === GLOBAL) this.updateOtherShards(key, undefined);
		return val;
	}

	async clear(guild: string | Guild) {
		const guildId = FirestoreProvider.getGuildID(guild);
		if (!this.settings.has(guildId)) return;
		this.settings.delete(guildId);

		const doc = this.db.collection(COLLECTION_NAME).doc(guildId);
		await doc.delete();
	}

	private async updateGuild(guildId: string, settings: GuildSettings) {
		const doc = this.db.collection(COLLECTION_NAME).doc(guildId);
		return doc.set(settings);
	}

	/**
	 * Loads all settings for a guild
	 * @param {string} guildId - Guild ID to load the settings of (or 'global')
	 * @param {Object} settings - Settings to load
	 * @private
	 */
	private setupGuild(guildId: string, settings: GuildSettings) {
		if (typeof guildId !== 'string') throw new TypeError('The guildId must be a guild ID or "global".');
		const guild = this.client.guilds.cache.get(guildId);

		// Load the command prefix
		if (typeof settings[PREFIX_KEY] !== 'undefined') {
			if (guild) guild['_commandPrefix'] = settings[PREFIX_KEY];
			else if (guildId === GLOBAL) this.client['_commandPrefix'] = settings[PREFIX_KEY];
		}

		// Load all command/group statuses
		for (const command of this.client.registry.commands.values()) this.setupGuildCommand(guildId, command, settings);
		for (const group of this.client.registry.groups.values()) this.setupGuildGroup(guildId, group, settings);
	}

	/**
	 * Sets up a command's status in a guild from the guild's settings
	 * @param {string} guildId - Guild ID to load the settings of (or 'global')
	 * @param {Command} command - Command to set the status of
	 * @param {Object} settings - Settings of the guild
	 * @private
	 */
	private setupGuildCommand(guildId: string, command: Command, settings: GuildSettings) {
		if (typeof guildId !== 'string') throw new TypeError('The guildId must be a guild ID or "global".');
		const guild = this.client.guilds.cache.get(guildId);

		const status = settings[getCommandStatusKey(command)];
		if (typeof status !== 'undefined') {
			if (guild) {
				if (!guild['_commandsEnabled']) guild['_commandsEnabled'] = {};
				guild['_commandsEnabled'][command.name] = status;
			} else if (guildId === GLOBAL) {
				command['_globalEnabled'] = status;
			}
		}
	}

	/**
	 * Sets up a group's status in a guild from the guild's settings
	 * @param {string} guildId - Guild ID to load the settings of (or 'global')
	 * @param {CommandGroup} group - Group to set the status of
	 * @param {Object} settings - Settings of the guild
	 * @private
	 */
	private setupGuildGroup(guildId: string, group: CommandGroup, settings: GuildSettings) {
		if (typeof guildId !== 'string') throw new TypeError('The guildId must be a guild ID or "global".');
		const guild = this.client.guilds.cache.get(guildId);

		const status = settings[getGroupStatusKey(group)];
		if (typeof status !== 'undefined') {
			if (guild) {
				if (!guild['_groupsEnabled']) guild['_groupsEnabled'] = {};
				guild['_groupsEnabled'][group.id] = status;
			} else if (guildId === GLOBAL) {
				group['_globalEnabled'] = status;
			}
		}
	}

	/**
	 * Updates a global setting on all other shards if using the {@link ShardingManager}.
	 * @param {string} key - Key of the setting to update
	 * @param {*} val - Value of the setting
	 * @private
	 */
	private updateOtherShards(key: string, val: any) {
		if (!this.client.shard) return;
		key = JSON.stringify(key);
		val = typeof val !== 'undefined' ? JSON.stringify(val) : 'undefined';
		this.client.shard.broadcastEval(`
			if(this.provider && this.provider.settings) {
				let global = this.provider.settings.get('global');
				if(!global) {
					global = {};
					this.provider.settings.set('global', global);
				}
				global[${key}] = ${val};
			}
		`);
	}

}
