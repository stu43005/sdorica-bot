import * as Discord from "discord.js";
import { ArgumentCollector, CommandoClient, CommandoMessage } from "discord.js-commando";
import { Logger } from "../../logger";
import { SubCommand } from "../../sub-command";
import { unreact } from "../../utils";

export default class ReactionRoleCommand extends SubCommand {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'reaction-role',
			aliases: ['rr'],
			group: 'config',
			memberName: 'reaction-role',
			description: '設定 ReactionRole',
			guildOnly: true,
			userPermissions: ['MANAGE_GUILD'],
		}, {
			funcs: [
				{
					name: 'list',
					aliases: ['show'],
					description: '顯示反應表情清單',
					run: (message, arg) => this.list(message, arg.argsResult.messageId),
					args: [
						{
							key: 'messageId',
							type: 'snowflake',
							prompt: '請輸入訊息ID',
							default: '',
						},
					],
				},
				{
					name: 'add',
					description: '新增反應表情',
					run: (message, arg) => this.add(message, arg.argsResult.channel, arg.argsResult.messageId, arg.argsResult.argString),
					args: [
						{
							key: 'channel',
							type: 'text-channel',
							prompt: '請輸入訊息所在的頻道',
						},
						{
							key: 'messageId',
							type: 'snowflake',
							prompt: '請輸入訊息ID',
						},
						{
							key: 'argString',
							type: 'string',
							prompt: 'function argument',
							default: '',
						},
					],
				},
				{
					name: 'unique',
					description: '將模式設為唯一',
					run: (message, arg) => this.setMode(message, arg.argsResult.messageId, ReactionRoleType.UNIQUE),
					args: [
						{
							key: 'messageId',
							type: 'snowflake',
							prompt: '請輸入訊息ID',
						},
					],
				},
				{
					name: 'remove',
					description: '移除反應表情',
					run: (message, arg) => this.remove(message, arg.argsResult.messageId, arg.argsResult.emojiOrRole),
					args: [
						{
							key: 'messageId',
							type: 'snowflake',
							prompt: '請輸入訊息ID',
						},
						{
							key: 'emojiOrRole',
							type: 'default-emoji|custom-emoji|role',
							prompt: '請輸入表情或用戶組名稱',
						},
					],
				},
				{
					name: 'clear',
					description: '清除反應表情',
					run: (message, arg) => this.clear(message, arg.argsResult.messageId),
					args: [
						{
							key: 'messageId',
							type: 'snowflake',
							prompt: '請輸入訊息ID',
						},
					],
				},
			],
		});

		this.initHooks(client);
	}

	async list(message: Discord.Message, messageId: string) {
		if (!message.guild) return null;
		const reactionRoles: ReactionRole[] = message.guild.settings.get("reactionRoles", []);
		const rrs = reactionRoles.filter(rr => (!messageId || rr.messageId == messageId) && rr.emojis.length);
		if (rrs.length === 0) {
			return message.say('You do not have any reaction roles.');
		}

		const embed = new Discord.MessageEmbed();
		embed.setTitle('Reaction roles');
		embed.addFields(rrs.map(rr => ({
			name: rr.messageId,
			value: rr.emojis.map(rrEmoji => {
				const emoji = message.guild?.emojis.resolve(rrEmoji.emoji);
				const role = message.guild?.roles.resolve(rrEmoji.roleId);
				return `${emoji ?? rrEmoji.emoji}: ${role ?? rrEmoji.roleId}`;
			}).join('\n'),
		})));
		return message.say(embed);
	}

	async add(message: Discord.Message, channel: Discord.TextChannel, messageId: string, argString: string) {
		const args = CommandoMessage.parseArgs(argString);

		do {
			const subArgsInfo = [
				{
					key: 'emoji',
					type: 'default-emoji|custom-emoji',
					prompt: '請輸入表情',
				},
				{
					key: 'role',
					type: 'role',
					prompt: '請輸入用戶組名稱',
				},
			];
			const subCollector = new ArgumentCollector(this.client, subArgsInfo);
			const subResult = await subCollector.obtain(message, args);
			if (subResult.cancelled || !subResult.values) {
				return null;
			}
			args.shift();
			args.shift();
			const { emoji, role } = subResult.values as {
				emoji: Discord.GuildEmoji | string,
				role: Discord.Role,
			};
			const emojiId = typeof emoji === 'string' ? emoji : emoji.id;

			const targetMessage = await channel.messages.fetch(messageId);
			await addReactionRole(targetMessage, emojiId, role.id);
		} while (args.length >= 2);

		return await message.reply("succeeded");
	}

	async setMode(message: Discord.Message, messageId: string, type: ReactionRoleType) {
		if (!message.guild) return null;
		const succeeded = await setReactionRoleMode(message.guild, messageId, type);
		return await message.reply(succeeded ? "succeeded" : "failed");
	}

	async remove(message: Discord.Message, messageId: string, emojiOrRole: Discord.GuildEmoji | string | Discord.Role) {
		if (!message.guild) return null;
		const emojiOrRoleId = typeof emojiOrRole === 'string' ? emojiOrRole : emojiOrRole.id;
		const succeeded = await removeReactionRole(message.guild, messageId, emojiOrRoleId);
		return await message.reply(succeeded ? "succeeded" : "failed");
	}

	async clear(message: Discord.Message, messageId: string) {
		if (!message.guild) return null;
		const succeeded = await clearReactionRole(message.guild, messageId);
		return await message.reply(succeeded ? "succeeded" : "failed");
	}

	initHooks(client: CommandoClient) {
		client.on("messageReactionAdd", async (messageReaction: Discord.MessageReaction, user: Discord.User | Discord.PartialUser) => {
			if (user.bot) return;
			const message = messageReaction.message;
			const guild = message.guild;
			if (!guild) return;
			if (!this.isEnabledIn(guild)) return;

			const member = guild.members.resolve(user.id);
			if (!member) return;

			const reactionRoles: ReactionRole[] = guild.settings.get("reactionRoles", []);
			if (!reactionRoles.length) return;

			const rr = reactionRoles.find(rr => rr.messageId == message.id);
			if (!rr) return;

			const emoji = messageReaction.emoji.id || messageReaction.emoji.name;
			const rrEmoji = rr.emojis.find(emo => emo.emoji == emoji);
			if (!rrEmoji) return;

			const role = member.guild.roles.resolve(rrEmoji.roleId);
			if (role === null) {
				removeReactionRole(guild, message.id, rrEmoji.roleId);
				return;
			}

			const roleIds = rr.emojis.map(emo => emo.roleId);
			const memberHasRoles = member.roles.cache.filter(role => roleIds.includes(role.id));

			let adds: ReactionRoleEmoji[] = [rrEmoji];
			let removes: ReactionRoleEmoji[] = [];
			let rollback = false;
			switch (rr.type) {
				case ReactionRoleType.NORMAL:
					break;
				case ReactionRoleType.VERIFY:
					rollback = true;
					break;
				case ReactionRoleType.UNIQUE:
					removes = removes.concat(rr.emojis.filter(emo => emo !== rrEmoji && memberHasRoles.find(r => r.id == emo.roleId)));
					break;
				case ReactionRoleType.DROP:
					adds = [];
					removes.push(rrEmoji);
					rollback = true;
					break;
				case ReactionRoleType.REVERSED:
					removes = adds;
					adds = [];
					break;
				case ReactionRoleType.LIMIT:
					if (memberHasRoles.size >= rr.limit) {
						adds = [];
					}
					break;
				case ReactionRoleType.BINDING:
					if (memberHasRoles.size > 0) {
						adds = [];
						rollback = true;
					}
					break;
			}

			const user2 = await user.fetch();
			try {
				if (adds.length) {
					adds.forEach(emo => {
						Logger.debug("add role: ", emo.roleId);
						const role = member.guild.roles.resolve(emo.roleId);
						if (role === null) {
							return;
						}
						member.roles.add(role.id);
					});
				}
				if (removes.length) {
					removes.forEach(emo => {
						Logger.debug("remove role: ", emo.roleId);
						const role = member.guild.roles.resolve(emo.roleId);
						if (role === null) {
							return;
						}
						member.roles.remove(role.id);
						unreact(messageReaction.message, emo.emoji, user2);
					});
				}
				if (rollback) {
					unreact(messageReaction.message, emoji, user2);
				}
			} catch (error) {
			}
		});

		client.on("messageReactionRemove", async (messageReaction: Discord.MessageReaction, user: Discord.User | Discord.PartialUser) => {
			if (user.bot) return;

			const message = messageReaction.message;
			const guild = message.guild;
			if (!guild) return;
			if (!this.isEnabledIn(guild)) return;

			const member = guild.members.resolve(user.id);
			if (!member) return;

			const reactionRoles: ReactionRole[] = guild.settings.get("reactionRoles", []);
			if (!reactionRoles.length) return;

			const rr = reactionRoles.find(rr => rr.messageId == message.id);
			if (!rr) return;

			const emoji = messageReaction.emoji.id || messageReaction.emoji.name;
			const rrEmoji = rr.emojis.find(emo => emo.emoji == emoji);
			if (!rrEmoji) return;

			const role = member.guild.roles.resolve(rrEmoji.roleId);
			if (role === null) {
				removeReactionRole(guild, message.id, rrEmoji.roleId);
				return;
			}

			let adds: ReactionRoleEmoji[] = [];
			let removes: ReactionRoleEmoji[] = [rrEmoji];
			switch (rr.type) {
				case ReactionRoleType.NORMAL:
				case ReactionRoleType.LIMIT:
				case ReactionRoleType.UNIQUE:
					break;
				case ReactionRoleType.VERIFY:
				case ReactionRoleType.BINDING:
				case ReactionRoleType.DROP:
					// do nothing
					return;
				case ReactionRoleType.REVERSED:
					adds = removes;
					removes = [];
					break;
			}

			try {
				if (adds.length) {
					adds.forEach(emo => {
						Logger.debug("add role: ", emo.roleId);
						const role = member.guild.roles.resolve(emo.roleId);
						if (role === null) {
							return;
						}
						member.roles.add(role.id);
					});
				}
				if (removes.length) {
					removes.forEach(emo => {
						Logger.debug("remove role: ", emo.roleId);
						const role = member.guild.roles.resolve(emo.roleId);
						if (role === null) {
							return;
						}
						member.roles.remove(role.id);
					});
				}
			} catch (error) {
			}
		});
	}

}

async function addReactionRole(message: Discord.Message, emoji: string, roleId: string) {
	if (!message.guild) return false;
	const reactionRoles: ReactionRole[] = message.guild.settings.get("reactionRoles", []);
	let rr = reactionRoles.find(rr => rr.messageId == message.id);
	if (!rr) {
		rr = {
			channelId: message.channel.id,
			messageId: message.id,
			emojis: [],
			type: ReactionRoleType.NORMAL,
			limit: 0,
		};
		reactionRoles.push(rr);
	}
	const rrEmoji = rr.emojis.find(emo => emo.emoji == emoji);
	if (rrEmoji) {
		return false;
	}
	rr.emojis.push({
		emoji: emoji,
		roleId: roleId,
	});
	message.react(emoji);
	Logger.debug(`[addReactionRole] message: ${message.id}, emoji: ${emoji}, role: ${roleId}`);
	await message.guild.settings.set('reactionRoles', reactionRoles);
	return true;
}

async function setReactionRoleMode(guild: Discord.Guild, messageId: string, mode: ReactionRoleType) {
	const reactionRoles: ReactionRole[] = guild.settings.get("reactionRoles", []);
	const rr = reactionRoles.find(rr => rr.messageId == messageId);
	if (!rr) {
		return false;
	}
	rr.type = mode;
	Logger.debug(`[setReactionRoleMode] message: ${messageId}, mode: ${mode}`);
	await guild.settings.set('reactionRoles', reactionRoles);
	return true;
}

async function removeReactionRole(guild: Discord.Guild, messageId: string, emojiOrRoleId: string) {
	const reactionRoles: ReactionRole[] = guild.settings.get("reactionRoles", []);
	const rrIndex = reactionRoles.findIndex(rr => rr.messageId == messageId);
	const rr = reactionRoles[rrIndex];
	if (!rr) { return false; }

	const rrEmojiIndex = rr.emojis.findIndex(emo => emo.emoji == emojiOrRoleId || emo.roleId == emojiOrRoleId);
	if (rrEmojiIndex === -1) { return false; }

	const rrEmoji = rr.emojis[rrEmojiIndex];
	rr.emojis.splice(rrEmojiIndex, 1);
	if (rr.emojis.length === 0) {
		reactionRoles.splice(rrIndex, 1);
	}

	const channel = guild.channels.resolve(rr.channelId);
	if (channel instanceof Discord.TextChannel) {
		const message = await channel.messages.fetch(messageId);
		if (message) {
			unreact(message, rrEmoji.emoji);
		}
	}

	Logger.debug(`[removeReactionRole] message: ${messageId}, emoji: ${rrEmoji.emoji}, role: ${rrEmoji.roleId}`);
	await guild.settings.set('reactionRoles', reactionRoles);
	return true;
}

async function clearReactionRole(guild: Discord.Guild, messageId: string) {
	const reactionRoles: ReactionRole[] = guild.settings.get("reactionRoles", []);
	const rrIndex = reactionRoles.findIndex(rr => rr.messageId == messageId);
	const rr = reactionRoles[rrIndex];
	if (!rr) { return false; }
	reactionRoles.splice(rrIndex, 1);

	const channel = guild.channels.resolve(rr.channelId);
	if (channel instanceof Discord.TextChannel) {
		const message = await channel.messages.fetch(messageId);
		if (message) {
			rr.emojis.forEach(rrEmoji => {
				unreact(message, rrEmoji.emoji);
			});
		}
	}

	Logger.debug(`[clearReactionRole] message: ${messageId}`);
	await guild.settings.set('reactionRoles', reactionRoles);
	return true;
}

export interface ReactionRole {
	channelId: string;
	messageId: string;
	emojis: ReactionRoleEmoji[];
	type: ReactionRoleType;
	limit: number;
}

export interface ReactionRoleEmoji {
	emoji: string;
	roleId: string;
}

export enum ReactionRoleType {
	/**
	 * Hands out roles when you click on them, does what you'd expect
	 *
	 * 反應表情獲得用戶組，再點一次則刪除
	 */
	NORMAL = 'normal',
	/**
	 * Only lets one role from the message be picked up at once
	 *
	 * 一次只能取得訊息中的一個用戶組，
	 * 自動消除舊的反應
	 */
	UNIQUE = 'unique',
	/**
	 * Roles can only be picked up, not removed
	 *
	 * 只能取得用戶組，不能刪除用戶組，
	 * 做出反應後會自動刪除該反應
	 *
	 * [add only]
	 */
	VERIFY = 'verify',
	/**
	 * Roles can only be removed, not picked up
	 *
	 * 用戶組只能刪除，不能取得
	 * (點擊表情符號將會移除用戶組)
	 *
	 * [add only]
	 */
	DROP = 'drop',
	/**
	 * Adding a reaction removes the role, removing the reaction adds a role
	 *
	 * 添加反應刪除用戶組，刪除反應添加用戶組
	 */
	REVERSED = 'reversed',
	/**
	 * Limits the total number of roles one can pick up from this message
	 *
	 * 限制可以從此訊息中獲得的用戶組總數
	 */
	LIMIT = 'limit',
	/**
	 * You can only choose one role and you can not swap between roles
	 *
	 * verify和unique的組合。
	 *
	 * 只能選擇一個角色，而不能在兩個角色之間交換
	 *
	 * [add only]
	 */
	BINDING = 'binding',
	// TEMP = 'temp',
}
