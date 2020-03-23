import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import { Random } from "random-js";
import { v4 as uuid } from "uuid";
import { BucketType, CooldownMapping } from "../../cooldown";
import { Command2 } from "../../typings/discord.js-commando/command";
import { arrayConcat, embedOriginUserData } from "../../utils";
import { StatCollection } from "../../stat-collection";

const random = new Random();
const buckets = CooldownMapping.fromCooldown(2, 5, BucketType.channel);

export default class MemeCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'meme',
			group: 'config',
			memberName: 'meme',
			description: '新增一則梗圖',
			guildOnly: true,
			userPermissions: ['MANAGE_GUILD'],

			args: [
				{
					key: 'type',
					type: 'string',
					prompt: '關鍵字匹配類型?',
					oneOf: ['add', 'create', 'n', 'normal', 's', 'strict', 'e', 'exact', 'sw', 'startswith', 'ew', 'endswith'],
				},
				{
					key: 'keyword',
					type: 'string',
					prompt: '關鍵字?',
				},
				{
					key: 'url',
					type: 'url',
					prompt: '圖片網址?',
				},
			],
		});

		client.on('message', (message: Discord.Message) => {
			if (message.author.bot) return;
			if (!message.guild) return;
			if (!this.isEnabledIn(message.guild)) return;

			// cooldown
			if (buckets.getBucket(message).updateRateLimit()) return;

			const memes: MemeItem[] = message.guild.settings.get('memes', []);
			const matches: MemeItem[] = [];
			for (let i = 0; i < memes.length; i++) {
				const item = memes[i];
				let reg = getMatchRegexp(item);
				if (reg && message.content.match(reg)) {
					matches.push(item);
				}
			}

			if (matches.length) {
				const index = random.integer(0, matches.length - 1);
				sendMeme(message, matches[index]);
				StatCollection.fromGuild(message.guild).addMeme(message, matches[index].keyword);
			}
		});
	}

	async run2(message: Discord.Message, { type, keyword, url }: { type: string, keyword: string, url: string }) {
		if (!message.guild) return null;

		const matchtype = getMatchType(type);
		if (matchtype && keyword && url) {
			const memes: MemeItem[] = message.guild.settings.get('memes', []);
			const newitem: MemeItem = {
				uuid: uuid(),
				keyword,
				url,
				matchtype,
			};
			memes.push(newitem);
			await message.guild.settings.set('memes', memes);

			let sendedMessages = arrayConcat([], await message.say(`Meme added. Preview:`));
			sendedMessages = arrayConcat(sendedMessages, await sendMeme(message, newitem));
			return sendedMessages;
		}
		return null;
	}

}

function getMatchRegexp(item: MemeItem) {
	switch (item.matchtype) {
		case MatchType.Normal:
			return new RegExp(regexpEscape(item.keyword), "i");
		case MatchType.Strict:
			return new RegExp(`(^|$|[\s.,:\u3002]+)${regexpEscape(item.keyword)}(^|$|[\s.,:\u3002]+)`, "i");
		case MatchType.Exact:
			return new RegExp(`^${regexpEscape(item.keyword)}$`, "i");
		case MatchType.StartsWith:
			return new RegExp(`^${regexpEscape(item.keyword)}`, "i");
		case MatchType.EndsWith:
			return new RegExp(`${regexpEscape(item.keyword)}$`, "i");
	}
}

export function getMatchType(str: string) {
	switch (String(str).toLowerCase()) {
		case "add":
		case "create":
		case "n":
		case "normal":
			return MatchType.Normal;
		case "s":
		case "strict":
			return MatchType.Strict;
		case "e":
		case "exact":
			return MatchType.Exact;
		case "sw":
		case "startswith":
			return MatchType.StartsWith;
		case "ew":
		case "endswith":
			return MatchType.EndsWith;
	}
	return null;
}

async function sendMeme(originMessage: Discord.Message, item: MemeItem) {
	const embed = new Discord.MessageEmbed();
	embed.setTitle(item.keyword);
	embed.setImage(item.url);
	return await originMessage.say(embedOriginUserData(originMessage, embed));
}

function regexpEscape(str: string) {
	return str.replace(/(\[|\\|\^|\$|\.|\||\?|\*|\+|\(|\))/g, "\\$1");
}

export interface MemeItem {
	uuid: string;
	keyword: string;
	matchtype: MatchType;
	url: string;
}

export enum MatchType {
	Normal = "normal",
	Strict = "strict",
	Exact = "exact",
	StartsWith = "startswith",
	EndsWith = "endswith",
}
