import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import fetch from "node-fetch";
import { Command2 } from "../../typings/discord.js-commando/command";
import { Logger } from "../../logger";

export default class HitokotoCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'hitokoto',
			aliases: ["一言"],
			group: 'fun',
			memberName: 'hitokoto',
			description: '獲取一則一言。',
			throttling: {
				usages: 2,
				duration: 5,
			},
		});
	}

	async run2(message: Discord.Message) {
		try {
			const res = await fetch("https://v1.hitokoto.cn/");
			const hitokoto: Hitokoto = await res.json();
			const embed = new Discord.MessageEmbed();
			embed.setTitle('一言');
			embed.setURL(`https://hitokoto.cn?id=${hitokoto.id}`);
			embed.setDescription(hitokoto.hitokoto);
			embed.setFooter(`-「${hitokoto.from}」`);
			return await message.say(embed);
		} catch (error) {
			Logger.error('[hitokoto]', error);
		}
		return null;
	}

}

export interface Hitokoto {
	/**
	 * 本条一言的id。
	 * 可以链接到 https://hitokoto.cn?id=[id] 查看这个一言的完整信息。
	 */
	id: number;
	/**
	 * 一言正文。编码方式unicode。使用utf-8。
	 */
	hitokoto: string;
	/**
	 * 类型。请参考第三节参数的表格。
	 */
	type: string;
	/**
	 * 一言的出处。
	 */
	from: string;
	/**
	 * 添加者。
	 */
	creator: string;
	/**
	 * 添加时间。
	 */
	created_at: string;
}
