import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import { Command2 } from "../../typings/discord.js-commando/command";

export default class DeleteBetweenCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'delete-between',
			group: 'moderator',
			memberName: 'delete-between',
			description: '刪除兩個訊息之間的所有訊息。',
			guildOnly: true,
			userPermissions: ['MANAGE_MESSAGES'],

			args: [
				{
					key: 'messageId1',
					type: 'snowflake',
					prompt: '請輸入第一個訊息ID',
				},
				{
					key: 'messageId2',
					type: 'snowflake',
					prompt: '請輸入第二個訊息ID',
				}
			],
		});
	}

	async run2(message: Discord.Message, { messageId1, messageId2 }: { messageId1: string, messageId2: string }) {
		const message1 = await message.channel.messages.fetch(messageId1);
		const message2 = await message.channel.messages.fetch(messageId2);

		if (!message1 || !message2) {
			return message.reply('找不到訊息。');
		}

		const [firstMsg, latestMsg] = message1.createdTimestamp < message2.createdTimestamp
			? [message1, message2]
			: [message2, message1];

		const messages = await message.channel.messages.fetch({
			before: latestMsg.id,
		});

		const ret = await message.reply('刪除中…');

		let count = 0;
		for (const [id, message] of messages) {
			if (message.createdTimestamp > firstMsg.createdTimestamp && message.createdTimestamp < latestMsg.createdTimestamp) {
				await message.delete();
				count++;
			}
		}

		await ret.edit(`已刪除 ${count} 則訊息。`);
		return ret;
	}

}
