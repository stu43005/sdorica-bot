import { tify } from 'chinese-conv';
import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import { URLSearchParams } from 'url';
import { cache } from '../../cache';
import { Command2 } from '../../typings/discord.js-commando/command';
import { Logger } from '../../logger';
import { getOnce, numMultiply } from '../../utils';
import { findTemplate, getMWBot, readTextWithCache } from "../../wiki";

const mw = getMWBot();
const rankText = [
	["零階", "(?<!ski)N", "0階"],
	["一階", "(?<!S)R", "藍階", "1階"],
	["二階", "(?<!S)SR", "紫階", "2階"],
	["三階", "SSR", "金階", "3階"],
];
const subrankRegexp = /\+(\d+)/;
const levelRegexp = /(?<![\+\dOPA])(\d+)(?!階|魂|O)/i;
const skillbookRegexp = /(技能書|Alt|Skill\s?Book|SB)/i;
const skinRegexp = /(造型書|Skin)/i;
const skillText = [
	["一魂", "1魂", "O1", "1O"],
	["二魂", "2魂", "O2", "2O"],
	["三魂", "3魂", "O3", "3O"],
	["四魂", "4魂", "O4", "4O"],
	["六魂", "6魂", "O6", "6O"],
	["被動", "P1"],
	["參謀", "A1"],
];

const charAlias: { [name: string]: string[] } = {
	"PAFF": ["paff"],
	"Nora": ["nora"],
	"NEKO＃ΦωΦ": ["NEKO", "NEKO#ΦωΦ"],
	"Ivy": ["ivy", "lvy"],
	"Deemo": ["deemo"],
	"黯月": ["暗月", "闇月"],
	"蠢熊勇士": ["^蠢熊$", "^蠢雄勇士", "^蠢雄$", "傻氣男友"],
	"麗莎SP": ["^lolisa"],
	"麗莎": ["^lisa"],
	"龐SP": ["黑龐"],
	"黛安娜": ["戴安娜"],
	"戴菲斯": ["老蛇"],
	"璃": ["^離", "leah"],
	"瑪莉亞": ["瑪麗亞", "玛丽亚"],
	"實驗體": ["敷符"],
	"雅辛托斯SP": ["^忍者阿辛$"],
	"雅辛托斯": ["阿辛"],
	"普吉": ["puggi"],
	"揚波": ["楊波"],
	"傑羅姆": ["小帥哥", "副官"],
	"莫里斯": ["莫裡斯"],
	"荷絲緹雅": ["人魚", "赫斯緹亞"],
	"納杰爾": ["^nj2", "納傑爾", "納捷爾", "羊角"],
	"娜雅": ["娜亞"],
	"夏爾SP": ["^C4$"],
	"夏爾": ["院長"],
	"面具小姐": ["^面具$", "面具女孩"],
	"迪蘭": ["辣個男人", "狄蘭", "^dl"],
	"泉": ["一隻米", "izumi"],
	"芙蕾莉卡": ["芙雷利卡", "奶子"],
	"法蒂瑪": ["豹姐"],
	"希歐": ["^co"],
	"艾利歐": ["小天使"],
	"米莎": ["misa", "小蛇"],
	"安潔莉亞SP": ["^安潔SP$"],
	"安潔莉亞": ["公主", "^安潔$"],
};

let MaxLevel = 70;
let MaxResonanceLevel = 15;

async function getConstantValues() {
	MaxLevel = await cache.getOrFetch('MaxLevel', async () => {
		return parseInt(await readTextWithCache("模板:Constant/MaxLevel"), 10);
	});
	MaxResonanceLevel = await cache.getOrFetch('MaxResonanceLevel', async () => {
		return parseInt(await readTextWithCache("模板:Constant/MaxResonanceLevel"), 10);
	});
}

export default class WikiCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'wiki',
			group: 'sdorica',
			memberName: 'wiki',
			description: '快速查詢Wiki資料',
			details: `使用此指令查詢角色時，會同時顯示角色的攻擊力血量數值。
其他參數如下：
> 階級相關：一階...SR...金階
> 加值相關：+10...+15...
> 等級相關：60...
> 技能相關：一魂...被動... (預設不顯示技能)
> 技能書：技能書.Alt (改為顯示技能書之技能)
使用指令後，在5分鐘內可由指令使用者按反應調整等級及加值。`,
			format: 'wiki [頁面名稱|角色名稱] [其他參數們]',
			examples: ['wiki 推薦隊伍', 'wiki 刃 60 +10 技能書 二魂'],
		});
	}

	async run2(message: Discord.Message, arg: string) {

		let args = arg.match(/((?!")[^ "]+|(?:")[^"]*(?:")|^$)/g)!;
		const wikiUrl = `https://sdorica.xyz/index.php/%E7%89%B9%E6%AE%8A:%E6%90%9C%E5%B0%8B/${encodeURIComponent(arg)}`;

		if (args.length > 0 && args[0] !== "") {
			// to Traditional Chinese
			args = args.map(s => tify(s));

			let name = args.shift()!.replace(/sp/i, "SP").replace(/mz/i, "MZ");

			const skillbookname = name.match(skillbookRegexp);
			if (skillbookname) {
				name = name.replace(new RegExp(skillbookRegexp, "ig"), "");
				args.push("Alt");
			}

			charAlias: for (const key in charAlias) {
				if (charAlias.hasOwnProperty(key)) {
					const aliases = charAlias[key];
					for (let i = 0; i < aliases.length; i++) {
						const str = aliases[i];
						if (name.match(new RegExp(str, "i"))) {
							name = name.replace(new RegExp(str, "i"), key);
							break charAlias;
						}
					}
				}
			}

			let heroData = cache.get<HeroData>(`HeroData/${name}`);
			if (!heroData) {
				heroData = new HeroData(name);
				if (!await heroData.getStatisics()) {
					// not hero
					return message.say(wikiUrl);
				}
				cache.set(`HeroData/${name}`, heroData);
			}

			// default value
			await getConstantValues();
			let level = MaxLevel;
			let rank = 3;
			let subrank = 0;
			const showSkills: string[] = [];
			let isSkillBook = false;
			let isSkin = false;

			let arg = args.join(" ");
			for (let i = rankText.length - 1; i >= 0; i--) {
				for (let j = 0; j < rankText[i].length; j++) {
					const str = rankText[i][j];
					const rankmatch = arg.match(new RegExp(str, "i"));
					if (rankmatch) {
						rank = i;
						arg = arg.replace(new RegExp(str, "i"), "");
					}
				}
			}

			if (rank == 3) {
				const submatch = arg.match(subrankRegexp);
				if (submatch) {
					subrank = parseInt(submatch[1], 10);
					arg = arg.replace(new RegExp(subrankRegexp, "g"), "");
					if (subrank < 0) {
						subrank = 0;
					}
					else if (subrank > MaxResonanceLevel) {
						subrank = MaxResonanceLevel;
					}
				}
			}

			const levelmatch = arg.match(levelRegexp);
			if (levelmatch) {
				level = parseInt(levelmatch[1], 10);
				arg = arg.replace(new RegExp(levelRegexp, "ig"), "");
				if (level < 1) {
					level = 1;
				}
				else if (level > MaxLevel) {
					level = MaxLevel;
				}
			}

			for (let i = 0; i < skillText.length; i++) {
				const strs = skillText[i];
				for (let j = 0; j < strs.length; j++) {
					const str = strs[j];
					const skillmatch = arg.match(new RegExp(str, "i"));
					if (skillmatch) {
						showSkills.push(strs[0]);
						arg = arg.replace(new RegExp(str, "i"), "");
						break;
					}
				}
			}

			const skillbookmatch = arg.match(skillbookRegexp);
			if (skillbookmatch) {
				isSkillBook = true;
				arg = arg.replace(new RegExp(skillbookRegexp, "ig"), "");
			}

			if (!isSkillBook) {
				const skinmatch = arg.match(skinRegexp);
				if (skinmatch) {
					isSkin = true;
					arg = arg.replace(new RegExp(skinRegexp, "ig"), "");
				}
			}

			const data = new CalcData(message, heroData, name, level, rank, subrank, showSkills, isSkillBook, isSkin);
			const sendedMessages = await data.init();
			return sendedMessages;
		}

		return message.say(`https://sdorica.xyz/`);
	}
}

class HeroData {
	public atk: number = 0;
	public hp: number = 0;
	private ranks: Record<string, string> = {};
	private skillsets: Record<string, Record<string, string>> = {};

	constructor(
		public readonly name: string,
	) { }

	async getStatisics() {
		const statisics = await readTextWithCache(`模板:角色數值/${this.name}`);
		if (!statisics) {
			Logger.debug(`查無此角色:`, this.name);
			return false;
		}

		const stAtkMatch = statisics.match(/\|\s*攻擊\s*\=\s*(\d+)\s*/);
		if (stAtkMatch) {
			this.atk = parseInt(stAtkMatch[1], 10);
		}
		else {
			Logger.error(`取得 ${this.name} 的角色 atk 數值時發生錯誤:`, statisics);
			return false;
		}

		const stHpMatch = statisics.match(/\|\s*體力\s*\=\s*(\d+)\s*/);
		if (stHpMatch) {
			this.hp = parseInt(stHpMatch[1], 10);
		}
		else {
			Logger.error(`取得 ${this.name} 的角色 hp 數值時發生錯誤:`, statisics);
			return false;
		}
		return true;
	}

	async getRankName() {
		if (this.ranks && this.ranks['三階']) {
			return this.ranks;
		}
		this.ranks = {};

		const charpage = await mw.parsetree(this.name);
		if (charpage) {
			const template = findTemplate(charpage, "角色頁面");
			if (template) {
				for (let i = 0; i < rankText.length; i++) {
					const str = String(rankText[i][0]);
					const rankPart = template.parts.find(p => p.name == str);
					if (rankPart && rankPart.value) {
						this.ranks[str] = rankPart.value;
					}
				}
				const rankAlt = template.parts.find(p => p.name == "Alt");
				if (rankAlt && rankAlt.value) {
					this.ranks["Alt"] = rankAlt.value;
				}
				const rankSkin = template.parts.find(p => p.name == "Skin");
				if (rankSkin && rankSkin.value) {
					this.ranks["Skin"] = rankSkin.value;
				}
			}
		}
		return this.ranks;
	}

	async getSkillSet(rankStr: string) {
		if (this.skillsets[rankStr]) {
			return this.skillsets[rankStr];
		}

		await this.getRankName();

		if (this.ranks[rankStr]) {
			const rankpage = await mw.parsetree(`模板:(${rankStr})${this.ranks[rankStr]}`);
			if (rankpage) {
				const template2 = findTemplate(rankpage, "角色/階級");
				if (template2) {
					const skillset = this.skillsets[rankStr] = this.skillsets[rankStr] || {};
					for (let i = 0; i < skillText.length; i++) {
						const str = skillText[i][0];
						const name = template2.parts.find(p => p.name == str + "技能");
						const type = template2.parts.find(p => p.name == str + "類型");
						const desc = template2.parts.find(p => p.name == str + "說明");
						const triggerLimit = template2.parts.find(p => p.name == str + "觸發限制");
						const counterAttack = template2.parts.find(p => p.name == str + "反擊限制");
						skillset[str + "技能"] = name ? name.value : "";
						skillset[str + "類型"] = type ? type.value : (str == "四魂" ? "方形" : (str == "三魂" ? "任意形狀" : ""));
						skillset[str + "說明"] = desc ? desc.value.replace(/\<br\s?\/?\>\n?/g, "\n") : "";
						skillset[str + "觸發限制"] = triggerLimit ? triggerLimit.value : "";
						skillset[str + "反擊限制"] = counterAttack ? counterAttack.value : "";
						if (str == "被動" && !skillset[str + "說明"]) {
							const unlock = template2.parts.find(p => p.name == "解鎖被動階級");
							skillset[str + "說明"] = unlock ? `_被動技能將在角色升至${unlock.value}共鳴時解鎖。_` : `_被動技能將在角色升至二階共鳴時解鎖。_`;
						}
					}
				}
			}
		}
		return this.skillsets[rankStr];
	}
}

class CalcData {
	private sender: string;
	private waitingReaction = true;
	private rankStr: string = '';
	private rankName: string = '';
	private skillset: Record<string, string> | undefined;

	constructor(
		private commandMessage: Discord.Message,
		private heroData: HeroData,
		private name: string,
		private level: number,
		private rank: number,
		private subrank: number,
		private showSkills: string[],
		private isSkillBook: boolean,
		private isSkin: boolean,
	) {
		this.sender = commandMessage.author.id;
	}

	public async init() {
		await this.checkRank();

		const sendedMessages = await this.commandMessage.say(this.generateEmbed());
		const sendedMessage = getOnce(sendedMessages);

		this.createReactionCollector(sendedMessage);
		this.doReact(sendedMessage);
		this.doGetExtraData(sendedMessage);
		return sendedMessages;
	}

	private async checkRank() {
		const rankName = await this.heroData.getRankName();
		if (this.isSkillBook && !rankName["Alt"]) {
			this.isSkillBook = false;
		}
		if (this.isSkin && !rankName["Skin"]) {
			this.isSkin = false;
		}
		while (this.rank < 3 && !rankName[rankText[this.rank][0]]) {
			this.rank++;
		}
		this.rankStr = this.isSkillBook ? "Alt" : this.isSkin ? "Skin" : rankText[this.rank][0];
		this.rankName = rankName[this.rankStr];
	}

	private createReactionCollector(message: Discord.Message) {
		const filter = (reaction: Discord.MessageReaction, user: Discord.User) => {
			return ["⬆", "⬇", "➕", "➖"].includes(reaction.emoji.name) && user.id === this.sender;
		};
		const collector = message.createReactionCollector(filter, { time: 300000 });
		collector.on('collect', reaction => {
			if (reaction.emoji.name === '⬆') {
				this.setLevel(this.level + 1);
			}
			else if (reaction.emoji.name === '⬇') {
				this.setLevel(this.level - 1);
			}
			else if (this.rank == 3 && reaction.emoji.name === '➕') {
				this.setSubrank(this.subrank + 1);
			}
			else if (this.rank == 3 && reaction.emoji.name === '➖') {
				this.setSubrank(this.subrank - 1);
			}
			if (message.channel.type !== "dm") {
				reaction.users.remove(this.sender);
			}
			message.edit(this.generateEmbed());
		});
		collector.on('end', collected => {
			if (message.channel.type !== "dm") {
				message.reactions.removeAll();
			} else if (message.client.user) {
				message.reactions.resolve("⬆")?.users.remove(message.client.user);
				message.reactions.resolve("⬇")?.users.remove(message.client.user);
				message.reactions.resolve("➕")?.users.remove(message.client.user);
				message.reactions.resolve("➖")?.users.remove(message.client.user);
			}
			this.waitingReaction = false;
			message.edit(this.generateEmbed());
		});
	}

	private async doReact(message: Discord.Message) {
		await message.react("⬆");
		await message.react("⬇");
		if (this.rank == 3) {
			await message.react("➕");
			await message.react("➖");
		}
	}

	private async doGetExtraData(message: Discord.Message) {
		if (this.showSkills.length > 0) {
			this.skillset = await this.heroData.getSkillSet(this.rankStr);
			await message.edit(this.generateEmbed());
		}
	}

	private setLevel(level: number) {
		this.level = level;
		if (this.level > MaxLevel) {
			this.level = MaxLevel;
		}
		if (this.level < 1) {
			this.level = 1;
		}
	}

	private setSubrank(subrank: number) {
		this.subrank = subrank;
		if (MaxResonanceLevel && this.subrank > MaxResonanceLevel) {
			this.subrank = MaxResonanceLevel;
		}
		if (this.subrank < 0) {
			this.subrank = 0;
		}
	}

	private generateEmbed() {
		const atk = calcStatistics(this.heroData.atk, this.level, this.rank, this.subrank, 50);
		const hp = calcStatistics(this.heroData.hp, this.level, this.rank, this.subrank, 300);

		let pageName = this.name;
		let imageName = this.name;
		if (this.rankName) {
			pageName = `${this.name}#(${this.rankStr})${this.rankName}`;
			if (this.isSkillBook || this.isSkin) {
				imageName = this.rankName;
			}
		}

		const embed = new Discord.MessageEmbed();
		embed.setThumbnail(`https://sdorica.xyz/index.php/特殊:重新導向/file/${imageName}_Potrait_Icons_SSR.png`);
		embed.setTitle(pageName);
		embed.setDescription(`等級: ${this.level}, 階級: ${rankText[this.rank][0]}, 加值: +${this.subrank}${this.isSkillBook ? ", 技能書" : this.isSkin ? ", 造型書" : ""}`);
		embed.setURL(`https://sdorica.xyz/index.php/${encodeURIComponent(pageName)}`);
		embed.addField('🗡️ 攻擊', atk || '-', true);
		embed.addField('❤️ 體力', hp || '-', true);
		if (this.waitingReaction) {
			embed.setFooter("5分鐘內可使用反應調整：⬆ 提高等級、⬇ 降低等級、➕ 提高加值、➖ 降低加值");
		}

		if (this.showSkills.length > 0) {
			if (this.skillset) {
				for (let i = 0; i < this.showSkills.length; i++) {
					const str = this.showSkills[i];
					if (this.skillset[str + "技能"]) {
						const skillname = `${this.skillset[str + "技能"]} (${str}${this.skillset[str + "類型"] ? ` ${this.skillset[str + "類型"]}` : ""})${this.skillset[str + "觸發限制"] ? "【觸發限制】" : ""}${this.skillset[str + "反擊限制"] ? "【反擊限制】" : ""}`;
						embed.addField(skillname, applyAtk(this.skillset[str + "說明"], atk));
					}
					else {
						embed.addField(str, '無此技能。');
					}
				}
			}
			else {
				for (let i = 0; i < this.showSkills.length; i++) {
					const str = this.showSkills[i];
					embed.addField(str, '技能載入中……');
				}
			}
		}
		return embed;
	}
}

export function applyAtk(info: string, atk: number): string {
	return info.replace(/\{\{atk\|([\d\.]+)\}\}/g, (match, p1) => {
		const mult = Number(p1);
		return `(💥${Math.floor(numMultiply(atk, mult))})`;
	});
}

export function toLevel(base: number, level: number): number {
	return Math.floor(numMultiply(base, Math.pow(1.06, level - 1)));
}

const rankAttr = [1, 1.08, 1.2, 1.35];
export function getRankAttr(rank: number, subrank: number) {
	let subAttr = 1;
	if (subrank > 10) subAttr = numMultiply(Math.pow(1.01, 5), Math.pow(1.03, subrank - 10));
	else if (subrank > 5) subAttr = Math.pow(1.01, subrank - 5);
	return Math.round(numMultiply(rankAttr[rank], subAttr) * 1000) / 1000;
}

export function calcStatistics(base: number, level: number, rank: number, subrank: number, es: number) {
	return Math.floor(numMultiply(toLevel(base, level), getRankAttr(rank, subrank))) + subrank * es;
}
