import { Message, TextChannel } from "discord.js";
import { ArgumentType, CommandoClient, CommandoMessage } from "discord.js-commando";

export default class GuildMessageArgumentType extends ArgumentType {
	constructor(client: CommandoClient) {
		super(client, 'guild-message');
	}

	async validate(val: string, msg: CommandoMessage) {
		if (!/^[0-9]+$/.test(val)) return false;

		let quoteMessage: Message | null = null;
		try {
			quoteMessage = await msg.channel.messages.fetch(val);
		} catch (error) {
			if (msg.guild) {
				const textChannels = msg.guild.channels.cache.filter(c => c.type == "text").array() as TextChannel[];
				for (let i = 0; i < textChannels.length; i++) {
					const channel = textChannels[i];
					const perms = msg.guild.me?.permissionsIn(channel);
					if (channel.id == msg.channel.id || !perms || !perms.has("VIEW_CHANNEL") || !perms.has("READ_MESSAGE_HISTORY")) {
						continue;
					}

					try {
						quoteMessage = await channel.messages.fetch(val);
						break;
					} catch (error2) {
					}
				}
			}
		}

		return Boolean(quoteMessage);
	}

	parse(val: string, msg: CommandoMessage) {
		let quoteMessage: Message | undefined = undefined;
		try {
			quoteMessage = msg.channel.messages.cache.get(val);
		} catch (error) {
			if (msg.guild) {
				const textChannels = msg.guild.channels.cache.filter(c => c.type == "text").array() as TextChannel[];
				for (let i = 0; i < textChannels.length; i++) {
					const channel = textChannels[i];
					const perms = msg.guild.me?.permissionsIn(channel);
					if (channel.id == msg.channel.id || !perms || !perms.has("VIEW_CHANNEL") || !perms.has("READ_MESSAGE_HISTORY")) {
						continue;
					}

					try {
						quoteMessage = channel.messages.cache.get(val);
						break;
					} catch (error2) {
					}
				}
			}
		}
		return quoteMessage;
	}
}
