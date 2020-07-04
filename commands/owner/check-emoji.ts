import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import admin from "firebase-admin";
import moment from "moment";
import { mergeRecordData } from "../../stat-collection";
import { Command2 } from "../../typings/discord.js-commando/command";

export default class CheckEmojiCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'check-emoji',
			group: 'owner',
			memberName: 'check-emoji',
			description: '顯示最不常使用的 30 個表符',
			ownerOnly: true,

			args: [
				{
					type: 'string',
					key: 'guildId',
					prompt: 'guild-id',
				},
				{
					type: 'integer',
					key: 'count',
					prompt: 'count',
					default: 30,
				}
			],
		});
	}

	async run2(message: Discord.Message, { guildId, count }: { guildId: string, count: number }) {

		const guild = message.client.guilds.resolve(guildId);
		if (!guild) {
			return message.say('錯誤的guild id');
		}

		const db = admin.firestore();
		const data: any = {
			emojis: [],
		};
		let day = moment();
		for (let i = 0; i < 4; i++) {
			day = day.subtract(7, 'days');
			const weekly = day.format('GGGG-[W]WW');
			const weeklyRef = db.collection('stat').doc(guildId).collection('weekly').doc(weekly);
			const weeklySnapshot = await weeklyRef.get();
			const weeklyData = weeklySnapshot.data() as any;
			if (weeklyData) {
				mergeRecordData(data, weeklyData, 'emojis');
				if (weeklyData['reactions']) {
					if (!data['emojis']) data['emojis'] = {};
					Object.keys(weeklyData['reactions']).forEach(key => {
						data['emojis'][key] = (data['emojis'][key] || 0) + weeklyData['reactions'][key];
					});
				}
			}
		}

		let data2: {
			count: number,
			emoji: Discord.GuildEmoji,
		}[] = [];
		guild.emojis.cache.forEach((emoji) => {
			data2.push({
				count: data.emojis[emoji.id] || 0,
				emoji
			});
		});
		data2 = data2.sort((a, b) => b.count - a.count).slice(data2.length - count);

		const data3: string[] = data2.map(e => {
			return `${e.emoji.animated ? ':a' : ''}:${e.emoji.name}: ${e.count}`;
		});

		return message.say(data3.join('\n'), {
			split: true,
		});
	}

}
