import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import { Command2 } from "../../typings/discord.js-commando/command";
import { arrayConcat } from "../../utils";

const key = 'autoCrossposting';

export default class AutoCrosspostingCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'auto-crossposting',
			group: 'config',
			memberName: 'auto-crossposting',
			description: '設定自動發佈貼文(必須是公告頻道)',
			guildOnly: true,
			userPermissions: ['MANAGE_GUILD'],

			args: [
				{
					key: 'channel',
					type: 'news-channel',
					prompt: '請輸入一個公告頻道',
				}
			],
		});

		client.on('message', async (message: Discord.Message) => {
			const guild = message.guild;
			if (!guild || !this.isEnabledIn(guild)) return;

			if (message.crosspostable) return;

			const channelId = message.channel.id;
			const list: string[] = guild.settings.get(key, []);
			if (list.indexOf(channelId) != -1) {
				await message.crosspost();
			}
		});
	}

	async run2(message: Discord.Message, { channel }: { channel: Discord.NewsChannel }) {
		if (!message.guild) return null;
		let result: Discord.Message[] = [];

		const list: string[] = message.guild.settings.get(key, []);
		const channelId = channel.id;

		const index = list.indexOf(channelId);
		if (index != -1) {
			// found, remove it
			list.splice(index, 1);
			result = arrayConcat(result, await message.say(`<#${channel.id}> 將不會自動發佈貼文`));
		} else {
			// add it
			list.push(channelId);
			result = arrayConcat(result, await message.say(`<#${channel.id}> 將會自動發佈貼文`));
		}

		await message.guild.settings.set(key, list);
		return result;
	}

}
