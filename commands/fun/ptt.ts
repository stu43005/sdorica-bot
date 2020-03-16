import cheerio from "cheerio";
import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import fetch, { FetchError } from "node-fetch";
import { BucketType, CooldownMapping } from "../../cooldown";
import { Command2 } from "../../typings/discord.js-commando/command";
import { Logger } from "../../logger";

const urlRegex = /((?:https?:)?\/\/)?((?:www\.ptt\.cc))\/bbs\/([\w\-]+)\/((?:M\.)([\d]+)(?:\.A\.)([\w]+))(?:\.html)/g;
const buckets = CooldownMapping.fromCooldown(1, 1, BucketType.user);

export default class PttCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'ptt',
			group: 'fun',
			memberName: 'ptt',
			description: '顯示 PTT 文章訊息',
		});

		client.on('message', (message: Discord.Message) => {
			if (message.author.bot) return;
			if (message.guild && !this.isEnabledIn(message.guild)) return;
			pttAutoEmbed(message);
		});
	}

	async run2(message: Discord.Message) {
		return pttAutoEmbed(message);
	}

}

async function pttAutoEmbed(message: Discord.Message) {
	// cooldown
	if (buckets.getBucket(message).updateRateLimit()) return null;

	const content = message.content;
	let result: RegExpExecArray | null;
	while ((result = urlRegex.exec(content)) !== null) {
		const url = result[0];
		try {
			const metaline = await getPttMetaline(url);

			Logger.debug('[ptt]', `url = \`${url}\``);
			Logger.debug('[ptt]', `metaline = \`${JSON.stringify(metaline)}\``);

			if (metaline["標題"] && metaline["nsfw"]) {
				const embed = new Discord.MessageEmbed();
				embed.setColor(789094);
				embed.setAuthor(`看板：${metaline["看板"]}　　作者：${metaline["作者"]}`);
				embed.setTitle(metaline["標題"]);
				embed.setDescription(metaline["內文"]);
				embed.setURL(url);
				embed.setFooter("※ 發信站: 批踢踢實業坊(ptt.cc)");
				embed.setTimestamp(new Date(`${metaline["時間"]} GMT+0800`));
				return await message.say(embed);
			}
		} catch (error) {
			if (!(error instanceof FetchError)) {
				Logger.error('[ptt]', error);
			}
		}
	}
	return null;
}

/*
{
	標題: "[洽特] 蔡X文 & 賴X德",
	看板: "AC_In",
	時間: "Mon Oct 14 23:29:10 2019",
	作者: "youhow0418 (ㄈ87b3)",
	內文: "だむ\n10/17発売のCOMIC失楽天 2019年12月号にて\n28PのHな漫画が載ります～！\nhttps://pbs.twimg.com/media/EG2PA0BUUAcXyCp.jpg\nhttps://pbs.twimg.com/media/EG2PAz3U4AAQU__.jpg\n"
}
*/
export async function getPttMetaline(url: string) {
	const html = await req(url, false);
	const $ = cheerio.load(html);
	const r18html = await req(url, true);
	const r18$ = cheerio.load(r18html);

	const metalinesData: { [key: string]: string } = {};

	const site_name = $("meta[property='og:site_name']").attr("content");
	metalinesData["nsfw"] = site_name ? "" : "true";

	const title = r18$("meta[property='og:title']").attr("content");
	const description = r18$("meta[property='og:description']").attr("content");
	if (description) metalinesData["內文"] = description;

	const metalines = r18$(".article-metaline, .article-metaline-right");
	metalines.each((index, element) => {
		const tag = r18$(".article-meta-tag", element);
		const value = r18$(".article-meta-value", element);
		metalinesData[tag.text()] = value.text();
	});

	return metalinesData;
}

async function req(url: string, over18: boolean = true): Promise<string> {
	const res = await fetch(url, {
		headers: {
			cookie: over18 ? "over18=1" : "",
		},
	});
	return await res.text();
}
