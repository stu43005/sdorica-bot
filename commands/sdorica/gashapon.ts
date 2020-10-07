import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import admin from "firebase-admin";
import rwc from "random-weighted-choice";
import { cache } from "../../cache";
import { heroEmojis, rankEmojis } from "../../emojis";
import { Command2 } from "../../typings/discord.js-commando/command";
import { arrayGroupBy, embedOriginUserData, getOnce, showCooldown } from "../../utils";
import { readTextWithCache } from "../../wiki";

const historyTime = 24 * 60 * 60 * 1000;

type Gashapons = Record<string, {
	weight: number;
	id: string;
}[]>;

interface GashaponData {
	userId: string;
	time: number;
	gashapon: string;
	results: GashaponResult[];
	counts: {
		SSR: number,
		SR: number,
		R: number,
		N: number,
	};
}
interface GashaponResult {
	hero: string;
	rank: string;
}

function addHistory(data: GashaponData) {
	const db = admin.firestore();
	db.collection("gashapon_history").add(data);
	cache.del(`gashapon_history/${data.userId}`);
}

async function getMyHistorys(userId: string) {
	const data = await cache.getOrFetch<GashaponData[]>(`gashapon_history/${userId}`, async () => {
		const db = admin.firestore();
		const snapshot = await db.collection("gashapon_history").where("userId", "==", userId).where("time", ">=", Date.now() - historyTime).get();
		if (snapshot.empty) {
			return [];
		}
		return snapshot.docs.map(doc => doc.data()) as GashaponData[];
	});
	return data;
}

export default class GashaponCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'gashapon',
			group: 'sdorica',
			memberName: 'gashapon',
			description: '試試你的非洲程度',
			examples: ['gashapon help', 'gashapon me', 'gashapon 萬象賦魂 10'],

			args: [
				{
					key: 'gashaponName',
					type: 'string',
					prompt: '您想要抽的賦魂名稱?',
					default: 'help',
				},
				{
					key: 'count',
					type: 'integer',
					prompt: '您想要抽的抽數?',
					default: 10,
				},
			],
		});
	}

	async run2(message: Discord.Message, { gashaponName, count }: { gashaponName: string, count: number }) {
		if (message.guild && message.guild.id === '437330083976445953' && message.channel.id !== '643335140902436905') {
			return message.reply(`禁止在此頻道使用指令，請至 <#643335140902436905> 頻道使用。`);
		}

		const gashapons = await cache.getOrFetch<Gashapons>('Gashapons', async () => {
			return JSON.parse(await readTextWithCache('使用者:小飄飄/bot/Gashapons.json')) as Gashapons;
		});

		if (gashaponName == "help" || gashaponName == "list") {
			const prefix = message.guild ? message.guild.commandPrefix : this.client.commandPrefix;
			const embed = new Discord.MessageEmbed();
			embed.setTitle('可用賦魂列表');
			embed.setDescription(Object.keys(gashapons).map((s, i) => `${i + 1}. [${s}](${encodeURI(`https://sdorica.xyz/index.php/${s}`)})`).join("\n"));
			embed.addField('使用方法', `${prefix}gashapon <賦魂名稱> [抽數(1,5,10)]`);
			embed.addField('顯示自己最近一天內的抽數', `${prefix}gashapon me`);
			return await message.say(embed);
		}

		if (gashaponName == "me") {
			const historys = await getMyHistorys(message.author.id);
			const groupByGashapons = arrayGroupBy(historys, r => r.gashapon);
			let out = "";
			for (const gashaponName in groupByGashapons) {
				if (groupByGashapons.hasOwnProperty(gashaponName)) {
					const datas = groupByGashapons[gashaponName];
					const count = datas.reduce((prev, curr) => prev + curr.results.length, 0);
					const countSSR = datas.reduce((prev, curr) => prev + curr.counts.SSR, 0);
					const countSR = datas.reduce((prev, curr) => prev + curr.counts.SR, 0);
					out += `${gashaponName}：${count} / ${rankEmojis['三階']}${countSSR} / ${rankEmojis['二階']}${countSR}\n`;
				}
			}
			const embed = new Discord.MessageEmbed();
			embed.setTitle('各賦魂池抽數');
			embed.setDescription(out);
			return await message.say(embedOriginUserData(message, embed));
		}

		if (isNaN(count) || (count != 1 && count != 5 && count != 10)) {
			count = 10;
		}

		const gashapon = gashapons[gashaponName];
		if (gashapon) {
			const results: GashaponResult[] = [];
			for (let i = 0; i < count; i++) {
				results.push(parseResult(rwc(gashapon)));
			}

			const data: GashaponData = {
				userId: message.author.id,
				time: Date.now(),
				gashapon: gashaponName,
				results: results,
				counts: {
					SSR: results.filter(s => s.rank == "三階").length,
					SR: results.filter(s => s.rank == "二階").length,
					R: results.filter(s => s.rank == "一階").length,
					N: results.filter(s => s.rank == "零階").length,
				}
			};

			addHistory(data);

			const animationEmbed = new Discord.MessageEmbed();
			animationEmbed.setTitle(gashaponName);
			animationEmbed.setURL(`https://sdorica.xyz/index.php/${gashaponName}`);
			animationEmbed.setThumbnail(`https://sdorica.xyz/index.php/特殊:重新導向/file/${gashaponName}(橫幅).jpg`);
			animationEmbed.setImage("https://media.discordapp.net/attachments/440490263245225994/608494798730428426/8a0ac007d09fab56.gif");
			const sendedMessages = await message.say(embedOriginUserData(message, animationEmbed));
			const sendedMessage = getOnce(sendedMessages);

			showCooldown(sendedMessage);

			message.client.setTimeout(() => {
				const resultEmbed = new Discord.MessageEmbed();
				resultEmbed.setThumbnail(`https://sdorica.xyz/index.php/特殊:重新導向/file/${gashaponName}(橫幅).jpg`);
				resultEmbed.setTitle(gashaponName);
				resultEmbed.setDescription(formatResult(results));
				resultEmbed.setURL(`https://sdorica.xyz/index.php/${gashaponName}`);
				sendedMessage.edit(embedOriginUserData(message, resultEmbed));

				if (data.counts.N == 10) {
					sendedMessage.react("673561486613938187"); // PuggiMask
				}
				if (data.counts.SSR > 0) {
					sendedMessage.react("594945785553092608"); // torch
				}
			}, 3000);

			return sendedMessages;
		}
		return null;
	}

}

function parseResult(result: string): GashaponResult {
	const strs = result.split(":");
	const name = strs[0];
	const rank = strs[1];
	return {
		hero: name,
		rank,
	};
}

function formatResult(results: GashaponResult[]) {
	return results.map(result => {
		return `${rankEmojis[result.rank] ?? result.rank} ${result.hero} ${heroEmojis[result.hero] ?? ""}`;
	}).join("\n");
}
