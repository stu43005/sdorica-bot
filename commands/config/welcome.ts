import * as Discord from "discord.js";
import { CommandoClient, CommandoMessage } from "discord.js-commando";
import { Command2 } from "../../typings/discord.js-commando/command";
import { arrayConcat } from "../../utils";

export default class WelcomeCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'welcome',
			group: 'config',
			memberName: 'welcome',
			description: '設定歡迎訊息',
			details: `功能列表：
setchannel - 設定要發送歡迎/離開/封鎖訊息的頻道。
welcome - 設定在新用戶加入時發送的歡迎訊息。
leave - 設定在用戶離開時發送的訊息。
banmsg - 設定在用戶被封鎖時發送的訊息。
dmjoin - 設定在新用戶加入時發送的 DM 訊息。
testgreet - 不確定您的歡迎/離開/DM消息的效果如何？ 只需輸入testgreet，就將它們全部吐出。`,
			guildOnly: true,
			userPermissions: ['MANAGE_GUILD'],

			args: [
				{
					type: 'string',
					key: 'func',
					prompt: '請選擇一個功能 (setchannel, welcome, leave, banmsg, dmjoin, testgreet)',
					oneOf: ['setchannel', 'channel', 'welcome', 'greet', 'leave', 'farewell', 'banmsg', 'dmjoin', 'pmjoin', 'joindm', 'joinpm', 'testgreet'],
				},
				{
					key: 'other',
					type: 'string',
					prompt: 'other',
					default: '',
				},
			],
		});

		this.initHooks(client);
	}

	async run2(message: Discord.Message, { func }: { func: string }) {
		const arg = message.argString.substr(message.argString.indexOf(func) + func.length).trim();
		const args = CommandoMessage.parseArgs(message.argString);
		args.shift();

		switch (func) {
			case 'setchannel':
			case 'channel':
				return await this.setchannel(message);
			case 'welcome':
			case 'greet':
				return await this.welcome(message, arg);
			case 'leave':
			case 'farewell':
				return await this.leave(message, arg);
			case 'banmsg':
				return await this.banmsg(message, arg);
			case 'dmjoin':
			case 'pmjoin':
			case 'joindm':
			case 'joinpm':
				return await this.dmjoin(message, arg);
			case 'testgreet':
				return await this.testgreet(message);
		}
		return null;
	}

	async setchannel(message: Discord.Message) {
		if (!message.guild) return null;

		const welcome = await getWelcomeConfig(message.guild);
		if (message.mentions.channels.size) {
			const channel = message.mentions.channels.first()!;
			const perm = channel.permissionsFor(message.guild.me!);
			if (perm && perm.has("SEND_MESSAGES")) {
				welcome.channelId = channel.id;
				await message.guild.settings.set('welcome', welcome);
				return message.say(`Welcome channel set to **#${channel.name}**`);
			}
			else {
				return message.say(`I do not have permissions to send messages to that channel, please give me send messages and try again.`);
			}
		}
		else {
			delete welcome.channelId;
			await message.guild.settings.set('welcome', welcome);
			return message.say(`Welcome channel removed.`);
		}
	}

	async welcome(message: Discord.Message, arg: string) {
		if (!message.guild) return null;

		const welcome = await getWelcomeConfig(message.guild);
		if (arg) {
			welcome.welcomeTemplate = arg;
			await message.guild.settings.set('welcome', welcome);
			return message.say(`Greet message updated.`);
		}
		else {
			delete welcome.welcomeTemplate;
			await message.guild.settings.set('welcome', welcome);
			return message.say(`Greeting message removed.`);
		}
	}

	async leave(message: Discord.Message, arg: string) {
		if (!message.guild) return null;

		const welcome = await getWelcomeConfig(message.guild);
		if (arg) {
			welcome.leaveTemplate = arg;
			await message.guild.settings.set('welcome', welcome);
			return message.say(`Farewell message updated.`);
		}
		else {
			delete welcome.leaveTemplate;
			await message.guild.settings.set('welcome', welcome);
			return message.say(`Farewell message removed.`);
		}
	}

	async banmsg(message: Discord.Message, arg: string) {
		if (!message.guild) return null;

		const welcome = await getWelcomeConfig(message.guild);
		if (arg) {
			welcome.banTemplate = arg;
			await message.guild.settings.set('welcome', welcome);
			return message.say(`Ban message updated.`);
		}
		else {
			delete welcome.banTemplate;
			await message.guild.settings.set('welcome', welcome);
			return message.say(`Ban message removed.`);
		}
	}

	async dmjoin(message: Discord.Message, arg: string) {
		if (!message.guild) return null;

		const welcome = await getWelcomeConfig(message.guild);
		if (arg) {
			welcome.dmjoinTemplate = arg;
			await message.guild.settings.set('welcome', welcome);
			return message.say(`DM on join message updated.`);
		}
		else {
			delete welcome.dmjoinTemplate;
			await message.guild.settings.set('welcome', welcome);
			return message.say(`DM on join message removed.`);
		}
	}

	async testgreet(message: Discord.Message) {
		if (!message.guild || !message.member) return null;

		const welcome = await getWelcomeConfig(message.guild);
		const status = new Discord.MessageEmbed();
		status.setTitle('Status');
		status.setDescription(`${welcome.channelId ? "☑️" : "❎"} Send messages permission
${welcome.welcomeTemplate ? "☑️" : "❎"} Greet message
${welcome.leaveTemplate ? "☑️" : "❎"} Farewell message
${welcome.banTemplate ? "☑️" : "❎"} Ban message
${welcome.dmjoinTemplate ? "☑️" : "❎"} DM message`);

		let sendedMessages = arrayConcat([], await message.say(status));
		sendedMessages = arrayConcat([], await message.say(welcome.welcomeTemplate ? formatTemplate(message.guild, message.member, welcome.welcomeTemplate) : "<<No greet message>>"));
		sendedMessages = arrayConcat([], await message.say(welcome.leaveTemplate ? formatTemplate(message.guild, message.member, welcome.leaveTemplate) : "<<No farewell message>>"));
		sendedMessages = arrayConcat([], await message.say(welcome.banTemplate ? formatTemplate(message.guild, message.member, welcome.banTemplate) : "<<No ban message>>"));
		sendedMessages = arrayConcat([], await message.say(welcome.dmjoinTemplate ? formatTemplate(message.guild, message.member, welcome.dmjoinTemplate) : "<<No dm message>>"));
		return sendedMessages;
	}

	initHooks(client: CommandoClient) {
		client.on("guildMemberAdd", async (member: Discord.GuildMember) => {
			const welcome = await getWelcomeConfig(member.guild);

			// send welcome message
			if (welcome.channelId && welcome.welcomeTemplate) {
				const channel = member.guild.channels.resolve(welcome.channelId);
				if (channel && channel.type === 'text') {
					await (channel as Discord.TextChannel).send(formatTemplate(member.guild, member, welcome.welcomeTemplate));
				}
			}

			// send dm on join message
			if (welcome.dmjoinTemplate) {
				const dm = await member.user.createDM();
				await dm.send(formatTemplate(member.guild, member, welcome.dmjoinTemplate));
			}
		});

		client.on("guildMemberRemove", async (member: Discord.GuildMember) => {
			const welcome = await getWelcomeConfig(member.guild);

			const banned = await member.guild.fetchBans();
			if (banned.has(member.id)) {
				// banned
			}
			else {
				// send leave message
				if (welcome.channelId && welcome.leaveTemplate) {
					const channel = member.guild.channels.resolve(welcome.channelId);
					if (channel && channel.type === 'text') {
						await (channel as Discord.TextChannel).send(formatTemplate(member.guild, member, welcome.leaveTemplate));
					}
				}
			}
		});

		client.on("guildBanAdd", async (guild: Discord.Guild, user: Discord.User) => {
			const welcome = await getWelcomeConfig(guild);

			// send ban message
			if (welcome.channelId && welcome.banTemplate) {
				const channel = guild.channels.resolve(welcome.channelId);
				if (channel && channel.type === 'text') {
					await (channel as Discord.TextChannel).send(formatTemplate(guild, user, welcome.banTemplate));
				}
			}
		});
	}
}

async function getWelcomeConfig(guild: Discord.Guild) {
	const welcome: WelcomeSetting = guild.settings.get('welcome', {});
	if (welcome.channelId) {
		const channel = guild.channels.resolve(welcome.channelId);
		if (!channel) {
			delete welcome.channelId;
			await guild.settings.set('welcome', welcome);
		}
		else if (guild.me) {
			const perm = channel.permissionsFor(guild.me);
			if (perm && perm.has("SEND_MESSAGES")) {
				// ok
			}
			else {
				delete welcome.channelId;
				await guild.settings.set('welcome', welcome);
			}
		}
	}
	return welcome;
}

function formatTemplate(guild: Discord.Guild, userMember: Discord.GuildMember | Discord.User, template: string) {
	if (!template) return "";
	return template.replace(/\{([^\}]*)\}/g, (substring, p1, ...args) => {
		const member = userMember as Discord.GuildMember;
		const user = member.user || userMember as Discord.User;
		switch (String(p1).toLowerCase()) {
			case "mention":
				return `<@${user.id}>`;
			case "user":
				return member.displayName || user.username;
			case "user(id)":
			case "user(name)":
				return user.username;
			case "user(proper)":
			case "user(tag)":
				return user.tag;
			case "server":
				return guild.name;
			case "server(members)":
				return `${guild.memberCount}`;
		}
		return substring;
	});
}

export interface WelcomeSetting {
	channelId?: string;
	welcomeTemplate?: string;
	leaveTemplate?: string;
	banTemplate?: string;
	dmjoinTemplate?: string;
}
