import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import { SubCommand } from "../../sub-command";
import { StarboardStore } from "./starboard-store.ignore";

interface StarboardSetting {
	channel?: string;
	limit?: number;
	allowNsfw?: boolean;
	ignore?: string[];
}

export default class StarboardCommand extends SubCommand {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'starboard',
			group: 'config',
			memberName: 'starboard',
			description: '設定 starboard',
			guildOnly: true,
			userPermissions: ['MANAGE_GUILD'],
		}, {
			funcs: [
				{
					name: 'setchannel',
					aliases: ['channel'],
					description: '設定 starboard 的頻道。',
					run: (message, arg) => this.setchannel(message),
				},
				{
					name: 'limit',
					description: '設定上榜所需星星數量。',
					run: (message, arg) => this.limit(message, arg.argsResult.count),
					args: [
						{
							key: 'count',
							type: 'integer',
							prompt: '請輸入上榜所需星星數量',
							default: -1,
						},
					]
				},
				{
					name: 'nsfw',
					description: '設定是否允許 NSFW 頻道上星。',
					run: (message, arg) => this.setnsfw(message),
				},
			],
		});

		this.initHooks(client);
	}

	async setchannel(message: Discord.Message) {
		if (!message.guild) return null;

		const starboard: StarboardSetting = await message.guild.settings.get('starboard', {});
		if (message.mentions.channels.size) {
			const channel = message.mentions.channels.first()!;
			const perm = channel.permissionsFor(message.guild.me!);
			if (perm && perm.has("SEND_MESSAGES")) {
				starboard.channel = channel.id;
				if (!starboard.limit) {
					starboard.limit = 4;
				}
				await message.guild.settings.set('starboard', starboard);
				return message.say(`Starboard enable in <#${starboard.channel}>.`);
			}
			else {
				return message.say(`I do not have permissions to send messages to that channel, please give me send messages and try again.`);
			}
		}
		else {
			delete starboard.channel;
			await message.guild.settings.set('starboard', starboard);
			return message.say(`Starboard disabled.`);
		}
	}

	async limit(message: Discord.Message, count: number) {
		if (!message.guild) return null;

		const starboard: StarboardSetting = await message.guild.settings.get('starboard', {});
		if (count === -1) {
			return await message.say(`Star limit is ${starboard.limit}.`);
		}

		if (count > 0 && count <= 25) {
			starboard.limit = count;
			await message.guild.settings.set('starboard', starboard);
			return await message.say(`Star limit set to ${count}.`);
		} else {
			return await message.say(`Star limit must between 1 and 25.`);
		}
	}

	async setnsfw(message: Discord.Message) {
		if (!message.guild) return null;

		const starboard: StarboardSetting = await message.guild.settings.get('starboard', {});
		if (starboard.allowNsfw) {
			starboard.allowNsfw = false;
			await message.guild.settings.set('starboard', starboard);
			return await message.say('Disallow NSFW content of starboard.');
		} else {
			starboard.allowNsfw = true;
			await message.guild.settings.set('starboard', starboard);
			return await message.say('Allow NSFW content of starboard.');
		}
	}

	initHooks(client: CommandoClient) {
		client.on('messageReactionAdd', async (messageReaction: Discord.MessageReaction, user: Discord.User) => {
			if (user.bot) return;
			const message = messageReaction.message;
			const guild = message.guild;
			if (!guild) return;
			if (!this.isEnabledIn(guild)) return;

			const starboard: StarboardSetting = await guild.settings.get('starboard', {});
			if (!starboard.channel || !starboard.limit) return;

			const channel = message.channel as Discord.TextChannel;
			if (!starboard.allowNsfw && channel.nsfw) {
				return;
			}

			if (messageReaction.emoji.name == "⭐") {
				if (messageReaction.partial) await messageReaction.fetch();
				const senderId = message.author.id;
				const senderStared = messageReaction.users.resolve(senderId);
				const count = (messageReaction.count ?? 0) - (senderStared ? 1 : 0);
				if (count >= starboard.limit) {
					if (message.partial) await message.fetch();
					await sendStarboard(starboard, message, count);
				}
			}
		});

	}

}

async function sendStarboard(setting: StarboardSetting, message: Discord.Message, count: number) {
	if (!message.guild) return;
	if (!setting.channel) return;
	const starboardChannel = message.guild.channels.resolve(setting.channel) as Discord.TextChannel;
	if (!starboardChannel) return;
	const template = getTemplate(message, count);

	const mapping = await StarboardStore.fromGuild(message.guild);
	await mapping.getTemporarilyTimer(message);

	const starData = mapping.getStarboardMessage(message);
	if (starData) {
		const starboardMessage = await starboardChannel.messages.fetch(starData.starboardMessageId);
		const edit = starboardMessage.edit(...template);
		mapping.setTemporarilyTimer(message, edit);
		await edit;
		mapping.updateCount(message, count);
		return;
	}
	const send = starboardChannel.send(...template);
	mapping.setTemporarilyTimer(message, send);
	const sendedMessage = await send;
	mapping.addStarboardMessage(message, count, sendedMessage);
}

function getTemplate(message: Discord.Message, count: number): [string, Discord.MessageEmbed] {
	const embed = new Discord.MessageEmbed();
	embed.setDescription(message.content);
	embed.setAuthor(message.author.tag, message.author.displayAvatarURL());
	embed.addField("Original", `[Show me!](${(message as unknown as Discord.Message).url})`);
	embed.setTimestamp(message.createdAt);
	return [`${count} ⭐ in <#${message.channel.id}>`, embed];
}
