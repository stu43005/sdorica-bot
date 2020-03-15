import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import { Command2 } from "../../typings/discord.js-commando/command";
import { Logger } from "../../logger";
import { getOnce } from "../../utils";

const starcountRegex = /^\**(\d+)/;

export default class StarboardAnalyticsCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'starboard-analytics',
			group: 'owner',
			memberName: 'starboard-analytics',
			description: '顯示 Starboard 統計訊息',
			guildOnly: true,
			userPermissions: ['MANAGE_GUILD'],
			ownerOnly: true,

			args: [
				{
					type: 'channel',
					key: 'text-channel',
					prompt: '哪一個是Starboard的頻道？',
				}
			],
		});
	}

	async run2(message: Discord.Message, { channel }: { channel: Discord.TextChannel }) {

		if (channel && channel.type == "text") {
			const sendedMessages = await message.say(`pleace wait...`);
			const sendedMessage = getOnce(sendedMessages);

			const data: AnalyticsMap = {
				count: {},
				max: {},
			};

			let result = await next(data, channel);
			let runcount = 1;
			await sendedMessage.edit(`pleace wait...${runcount}`);

			while (typeof result == "string") {
				result = await next(data, channel, result);
				runcount++;
				await sendedMessage.edit(`pleace wait...${runcount}`);

				if (result === false) {
					break;
				}
				if (runcount > 100) {
					Logger.error(`[starboard-analytics] Error: runcount > 100`);
					break;
				}
			}

			const sortedData: Analytics = {
				count: values(data.count).sort((a, b) => b.num - a.num).slice(0, 5),
				max: values(data.max).sort((a, b) => b.num - a.num).slice(0, 5),
			};

			const embed = new Discord.MessageEmbed();
			embed.setTitle("Meow!");
			embed.addField("上榜最多次的使用者", `top5:\n` + sortedData.count.map((e, index) => `\`${index + 1}. ${e.username}: ${e.num}\``).join("\n"));
			embed.addField("上星數量最多的使用者", `top5:\n` + sortedData.max.map((e, index) => `\`${index + 1}. ${e.username}: ${e.num}\``).join("\n"));
			await sendedMessage.edit(embed);

			return sendedMessages;
		}
		return null;
	}
}

interface Analytics {
	count: AnalyticsEntry[];
	max: AnalyticsEntry[];
}

interface AnalyticsMap {
	count: { [id: string]: AnalyticsEntry };
	max: { [id: string]: AnalyticsEntry };
}

interface AnalyticsEntry {
	username: string;
	num: number;
}

async function next(data: AnalyticsMap, channel: Discord.TextChannel, before?: Discord.Snowflake) {
	const messages = await channel.messages.fetch({
		before,
	});
	if (before) {
		messages.delete(before);
	}
	if (messages.size < 2) {
		return false;
	}

	messages.forEach(message => {
		const messageData = getMessageDataFromSora(message);
		if (!messageData.username || !messageData.starcount) return;

		if (!data.count[messageData.username]) {
			data.count[messageData.username] = {
				username: messageData.username,
				num: 0,
			};
		}
		data.count[messageData.username].num++;

		if (!data.max[messageData.username]) {
			data.max[messageData.username] = {
				username: messageData.username,
				num: 0,
			};
		}
		if (data.max[messageData.username].num < messageData.starcount) {
			data.max[messageData.username].num = messageData.starcount;
		}
	});

	const ids = [...messages.keys()].map(s => Number(s));
	const minId = Math.min(...ids);
	return String(minId);
}

interface SoraMessageData {
	username: string;
	starcount: number;
}

function getMessageDataFromSora(message: Discord.Message) {
	const data: SoraMessageData = {
		username: "",
		starcount: 0,
	};
	if (message.author.id === '270931284489011202' || message.author.id === '452086361432915978') {
		const starcountMatch = starcountRegex.exec(message.content);
		if (starcountMatch) {
			data.starcount = Number(starcountMatch[1]);
		}
		if (message.embeds.length > 0 && message.embeds[0].author && message.embeds[0].author.name) {
			data.username = message.embeds[0].author.name;
		}
	}
	return data;
}

function values(obj: { [key: string]: any }) {
	const elements: any[] = [];
	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			const element = obj[key];
			elements.push(element);
		}
	}
	return elements;
}
