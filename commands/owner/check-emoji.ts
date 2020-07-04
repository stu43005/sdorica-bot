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
			description: 'check-emoji',
			ownerOnly: true,

			args: [
				{
					type: 'string',
					key: 'guildId',
					prompt: 'guild-id',
				}
			],
		});
	}

	async run2(message: Discord.Message, { guildId }: { guildId: string }) {

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
			}
		}

		let data2: {
			id: string,
			name: string,
			count: number,
			emoji: Discord.GuildEmoji,
		}[] = [];
		guild.emojis.cache.forEach((emoji) => {
			data2.push({
				id: emoji.id,
				name: emoji.name,
				count: data.emojis[emoji.id] || 0,
				emoji
			});
		});
		data2 = data2.sort((a, b) => a.count - b.count);

		const data3: string[] = data2.filter(e => e.count > 0).map(e => {
			return `${e.emoji}: ${e.count}`;
		}).concat(['', 'No use:']).concat(data2.filter(e => e.count == 0).map(e => {
			return `${e.emoji}`;
		}).join(' '));

		return message.say(data3.join('\n'), {
			split: true,
		});
	}

}
