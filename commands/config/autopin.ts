import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import { Command2 } from "../../typings/discord.js-commando/command";

const key = 'autopinCount';

export default class AutoPinCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'autopin',
			group: 'config',
			memberName: 'autopin',
			description: '設定自動釘選所需📌(`:pushpin:`)的數量',
			guildOnly: true,
			userPermissions: ['MANAGE_GUILD'],

			args: [
				{
					key: 'count',
					type: 'integer',
					prompt: '自動釘選所需📌的數量？',
					default: -1,
				}
			],
		});

		client.on('messageReactionAdd', (messageReaction: Discord.MessageReaction, user: Discord.User) => {
			if (user.bot) return;
			const guild = messageReaction.message.guild;
			if (!guild) return;
			if (!this.isEnabledIn(guild)) return;

			const count = guild.settings.get(key);
			if (typeof count === 'undefined' || count === 0) return;
			autopin(count, messageReaction, user);
		});
	}

	async run2(message: Discord.Message, { count }: { count?: number }) {
		if (!message.guild) return null;

		let value = message.guild.settings.get(key);
		if (typeof count !== 'undefined' && count > 0) {
			value = count;
			await message.guild.settings.set(key, count);
		}
		return await message.say(`目前自動釘選所需📌的數量為：${value}`);
	}

}

async function autopin(needPushPinCount: number, messageReaction: Discord.MessageReaction, user: Discord.User) {
	if (messageReaction.partial) await messageReaction.fetch();
	if (messageReaction.message.partial) await messageReaction.message.fetch();

	const member = messageReaction.message.guild?.members.resolve(user.id);
	if (messageReaction.emoji.name == "📌") {
		if (member && member.permissionsIn(messageReaction.message.channel).has("MANAGE_MESSAGES")) {
			await pinMessage(messageReaction.message);
		}
		else if (messageReaction.count! >= needPushPinCount) {
			await pinMessage(messageReaction.message);
		}
	}
	else if (messageReaction.emoji.name == "❌") {
		if (member && member.permissionsIn(messageReaction.message.channel).has("MANAGE_MESSAGES")) {
			await unpinMessage(messageReaction.message);
		}
	}
}

const pinnedMessages: string[] = [];

async function pinMessage(message: Discord.Message) {
	if (message.pinnable && !message.pinned && pinnedMessages.indexOf(message.id) == -1) {
		const x = message.reactions.cache.find((react) => react.emoji.name === '❌');
		if (x) {
			const xAdmin = x.users.cache.filter(user => {
				const member = message.guild?.members.cache.get(user.id);
				return !!member && member.permissionsIn(message.channel).has("MANAGE_MESSAGES");
			});
			if (xAdmin.size > 0) {
				return;
			}
		}
		pinnedMessages.push(message.id);
		await message.pin();
	}
}

async function unpinMessage(message: Discord.Message) {
	if (message.pinnable && message.pinned) {
		await message.unpin();
	}
}
