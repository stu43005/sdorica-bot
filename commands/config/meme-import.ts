import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import fetch from "node-fetch";
import { isArray } from "util";
import { v4 as uuid } from "uuid";
import { Command2 } from "../../typings/discord.js-commando/command";
import { getMatchType, MatchType, MemeItem } from "./meme";

export default class MemeImportCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'meme-import',
			group: 'config',
			memberName: 'meme-import',
			description: '批次匯入梗圖',
			examples: ['importmeme [{"keyword":"可憐哪","url":"https://cdn.discordapp.com/attachments/524544088503091201/667322574186872832/7XeMJWN.png","matchtype":"strict"}]'],
			guildOnly: true,
			userPermissions: ['MANAGE_GUILD'],
		});
	}

	async run2(message: Discord.Message, arg: string) {
		if (!message.guild) return null;
		try {
			let json: any;
			if (message.attachments.size) {
				const atta = message.attachments.first()!;
				const res = await fetch(atta.url);
				const content = await res.text();
				json = JSON.parse(content);
			} else {
				json = JSON.parse(arg);
			}

			if (isArray(json)) {
				const memes: MemeItem[] = message.guild.settings.get('memes', []);
				const errors: string[] = [];
				let addCount = 0;
				json.forEach((item, index) => {
					if (item.keyword && item.url) {
						if (memes.some(meme => item.keyword === meme.keyword && item.url === meme.url)) {
							// same keyword and url already exists
							return;
						}
						const matchtype = item.matchtype && getMatchType(item.matchtype) || MatchType.Normal;
						memes.push({
							uuid: uuid(),
							keyword: item.keyword,
							url: item.url,
							matchtype,
						});
						addCount++;
					} else {
						errors.push(`index:[${index}] missing keyword or url.`);
					}
				});

				await message.guild.settings.set('memes', memes);
				if (errors.length) {
					await message.say("Errors:\n" + errors.join("\n"));
				}
				return await message.reply(`Import ${addCount} memes.`);
			} else {
				throw "json is not a array.";
			}
		} catch (error) {
			return await message.reply(error.toString());
		}
	}

}
