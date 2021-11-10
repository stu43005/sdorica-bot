import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import fetch from "node-fetch";
import rwc from "random-weighted-choice";
import { cache } from "../../cache";
import { Command2 } from "../../typings/discord.js-commando/command";
import { embedOriginUserData, getOnce, showCooldown } from "../../utils";

type MonsterTrap = {
	items: Record<string, {
		weight: number;
		id: string;
	}[]>;
	monsters: Record<string, Record<string, [string, string, string, string]>>;
	ability: Record<string, {
		weight: number;
		id: string;
	}[]>;
};

export default class MonsterCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'monster',
			group: 'sdorica',
			memberName: 'monster',
			description: '野獸抽抽樂',
			examples: ['monster help', 'monster 家園的呼喚'],

			args: [
				{
					key: 'itemName',
					type: 'string',
					prompt: '您想要抽的道具名稱?',
					default: 'help',
				},
			],
		});
	}

	async run2(message: Discord.Message, { itemName }: { itemName: string }) {
		if (message.guild && message.guild.id === '437330083976445953' && message.channel.id !== '643335140902436905') {
			return message.reply(`禁止在此頻道使用指令，請至 <#643335140902436905> 頻道使用。`);
		}

		const monsterTrap = await cache.getOrFetch<MonsterTrap>('MonsterTrap', async () => {
			const resp = await fetch('https://raw.githubusercontent.com/stu43005/sdorica-wiki-bot/data/wiki/MonsterTrap.json');
			return await resp.json() as MonsterTrap;
		});

		if (itemName == "help" || itemName == "list") {
			const prefix = message.guild ? message.guild.commandPrefix : this.client.commandPrefix;
			const embed = new Discord.MessageEmbed();
			embed.setTitle('可用道具列表');
			embed.setDescription(Object.keys(monsterTrap.items).map((s, i) => `${i + 1}. [${s}](${encodeURI(`https://sdorica.xyz/index.php/${s}`)})`).join("\n"));
			embed.addField('使用方法', `${prefix}monster <道具名稱>`);
			return await message.say(embed);
		}

		const item = monsterTrap.items[itemName];
		if (item) {
			const monsterAndRank = rwc(item);
			const [monster, rank] = monsterAndRank.split(":");
			const abilitys = monsterTrap.monsters[monster] ? monsterTrap.monsters[monster][rank] : undefined;
			if (abilitys) {
				const skill1table = monsterTrap.ability[abilitys[0]];
				const skill2table = monsterTrap.ability[abilitys[1]];
				const speciality1table = monsterTrap.ability[abilitys[2]];
				const speciality2table = monsterTrap.ability[abilitys[3]];

				const skill1 = skill1table ? rwc(skill1table) : "未知技能";
				const skill2 = skill2table ? rwc(skill2table) : "未知技能";
				const speciality1 = speciality1table ? rwc(speciality1table) : "未知特長";
				const speciality2 = speciality2table ? rwc(speciality2table) : "未知特長";

				const animationEmbed = new Discord.MessageEmbed();
				animationEmbed.setTitle(`Get Items`);
				animationEmbed.setAuthor(itemName, `https://sdorica.xyz/index.php/特殊:重新導向/file/${itemName}_M_Icon.png`, `https://sdorica.xyz/index.php/${itemName}`);
				animationEmbed.setImage("https://cdn.discordapp.com/attachments/461498327746347018/641641290471047168/ex_trap_lossy.gif");
				const sendedMessages = await message.say(embedOriginUserData(message, animationEmbed));
				const sendedMessage = getOnce(sendedMessages);

				showCooldown(sendedMessage);

				message.client.setTimeout(() => {
					const resultEmbed = new Discord.MessageEmbed();
					animationEmbed.setAuthor(itemName, `https://sdorica.xyz/index.php/特殊:重新導向/file/${itemName}_M_Icon.png`, `https://sdorica.xyz/index.php/${itemName}`);
					resultEmbed.setThumbnail(`https://sdorica.xyz/index.php/特殊:重新導向/file/${monster}_Mob.png`);
					resultEmbed.setTitle(`【★ ${rank}】${monster}`);
					resultEmbed.setDescription(`技能一：${skill1}\n技能二：${skill2}\n特長一：${speciality1}\n特長二：${speciality2}`);
					resultEmbed.setURL(`https://sdorica.xyz/index.php/${monster}`);
					sendedMessage.edit(embedOriginUserData(message, resultEmbed));
				}, 3000);

				return sendedMessages;
			}
		}
		return null;
	}

}
