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
				}
			],
		});

		this.initHooks(client);
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

	initHooks(client: CommandoClient) {
		client.on("messageReactionAdd", async (messageReaction: Discord.MessageReaction, user: Discord.User) => {
			if (user.bot) return;
			const message = messageReaction.message;
			const guild = message.guild;
			if (!guild) return;
			if (!this.isEnabledIn(guild)) return;

			const member = guild.members.resolve(user);
			if (!member) return;

			const reactionRoles: ReactionRole[] = guild.settings.get("reactionRoles", []);
			if (!reactionRoles.length) return;

			const rr = reactionRoles.find(rr => rr.messageId == message.id);
			if (!rr) return;

			const emoji = messageReaction.emoji.id || messageReaction.emoji.name;
			const rrEmoji = rr.emojis.find(emo => emo.emoji == emoji);
			if (!rrEmoji) return;

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

			try {
				if (adds.length) {
					adds.forEach(emo => {
						Logger.debug("add role: ", emo.roleId);
						member.roles.add(emo.roleId);
					});
				}
				if (removes.length) {
					removes.forEach(emo => {
						Logger.debug("remove role: ", emo.roleId);
						member.roles.remove(emo.roleId);
						unreact(messageReaction.message, emo.emoji, user);
					});
				}
				if (rollback) {
					unreact(messageReaction.message, emoji, user);
				}
			} catch (error) {
			}
		});

		client.on("messageReactionRemove", async (messageReaction: Discord.MessageReaction, user: Discord.User) => {
			if (user.bot) return;

			const message = messageReaction.message;
			const guild = message.guild;
			if (!guild) return;
			if (!this.isEnabledIn(guild)) return;

			const member = guild.members.resolve(user);
			if (!member) return;

			const reactionRoles: ReactionRole[] = guild.settings.get("reactionRoles", []);
			if (!reactionRoles.length) return;

			const rr = reactionRoles.find(rr => rr.messageId == message.id);
			if (!rr) return;

			const emoji = messageReaction.emoji.id || messageReaction.emoji.name;
			const rrEmoji = rr.emojis.find(emo => emo.emoji == emoji);
			if (!rrEmoji) return;

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
						member.roles.add(emo.roleId);
					});
				}
				if (removes.length) {
					removes.forEach(emo => {
						Logger.debug("remove role: ", emo.roleId);
						member.roles.remove(emo.roleId);
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
	let rr = reactionRoles.find(rr => rr.messageId == messageId);
	if (!rr) {
		return;
	}
	rr.type = mode;
	Logger.debug(`[setReactionRoleMode] message: ${messageId}, mode: ${mode}`);
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
