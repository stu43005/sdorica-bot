import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import { Command2 } from '../../typings/discord.js-commando/command';

export default class WikiDisableCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'wiki',
			group: 'sdorica',
			memberName: 'wiki-disable',
			description: '快速查詢Wiki資料',
			details: `Wiki已於2021/10/31結束營運。`,
			format: 'wiki [頁面名稱|角色名稱] [其他參數們]',
			examples: ['wiki 推薦隊伍', 'wiki 刃 60 +10 技能書 二魂'],
			hidden: true,
		});
	}

	async run2(message: Discord.Message, arg: string) {
		return message.reply('Wiki已於2021/10/31結束營運。');
	}
}
