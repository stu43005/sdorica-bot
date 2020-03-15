import MWBot, { MWRevisionSlot, MWRevision } from "mwbot";
import fetch from "node-fetch";
import { Element, xml2js } from "xml-js";
import { cache } from "./cache";

const bot = new MWBot({
	apiUrl: 'https://sdorica.xyz/api.php',
});

bot.readText = async function (title: string, redirect: boolean, customRequestOptions?: MWBot.RequestOptions): Promise<string> {
	const res = await this.read(title, redirect, customRequestOptions);
	for (const pageid in res.query.pages) {
		const page = res.query.pages[pageid];
		if (page.title == title && page.revisions) {
			if ("slots" in page.revisions[0]) {
				const slot = page.revisions[0] as MWRevisionSlot;
				return slot["slots"]["main"]["*"];
			}
			else {
				const revision = page.revisions[0] as MWRevision;
				return revision['*'];
			}
		}
	}
	return "";
};

bot.parsetree = async function (title: string, customRequestOptions?: MWBot.RequestOptions) {
	const resp = await this.request({
		action: 'parse',
		prop: 'parsetree',
		page: title,
		redirects: 'yes'
	}, customRequestOptions);
	if (resp.error) return;
	const xmlContent = resp["parse"]["parsetree"]["*"];
	if (xmlContent) {
		return xml2js(xmlContent, { compact: false }) as Element;
	}
};

export function getMWBot() {
	return bot;
}

export async function getWikiFile(name: string) {
	const res = await fetch(encodeURI(`https://sdorica.xyz/index.php/特殊:重新導向/file/${name}`));
	return await res.buffer();
}

export async function readTextWithCache(title: string) {
	return cache.getOrFetch<string>(`wiki/${title}`, () => {
		return bot.readText(title, true);
	});
}

//#region findTemplate

export function findTemplate(json: Element, title: string): Template | undefined {
	if (json.type == "element" && json.name == "template") {
		const template = compactTemplate(json);
		if (template.title == title) {
			return template;
		}
	}
	if (json.elements) {
		for (let i = 0; i < json.elements.length; i++) {
			const value = json.elements[i];
			const result = findTemplate(value, title);
			if (result) {
				return result;
			}
		}
	}
}

export interface Template {
	title: string;
	parts: TemplatePart[];
}

export interface TemplatePart {
	name: string;
	value: string;
}

export function compactTemplate(json: Element) {
	const template: Template = {
		title: "",
		parts: [],
	};
	if (json.elements) {
		for (let i = 0; i < json.elements.length; i++) {
			const element: Element = json.elements[i];
			if (element.type == "element") {
				switch (element.name) {
					case "title":
						template.title = json2string(element.elements).trim();
						break;

					case "part":
						template.parts.push(compactTemplatePart(element));
						break;
				}
			}
		}
	}
	return template;
}

export function compactTemplatePart(json: Element) {
	const templatePart: TemplatePart = {
		name: "",
		value: "",
	};
	if (json.elements) {
		for (let i = 0; i < json.elements.length; i++) {
			const element: Element = json.elements[i];
			if (element.type == "element") {
				switch (element.name) {
					case "name":
						if (element.attributes && element.attributes.index) {
							templatePart.name = String(element.attributes.index);
						}
						else if (element.elements) {
							templatePart.name = json2string(element.elements).trim();
						}
						break;

					case "value":
						templatePart.value = json2string(element.elements).trim();
						break;
				}
			}
		}
	}
	return templatePart;
}

const skillinfoKeywords = ["減傷", "強化", "怒氣", "戰意", "再生", "轉盾", "盾轉", "靈巧", "領袖", "易傷", "弱化", "撕裂", "中毒", "暈眩", "踉蹌", "嘲諷", "反擊", "免疫", "反射", "狂暴", "韌性", "抗體", "復甦", "強力反擊", "屍偶", "長效", "標記", "支援", "元氣", "破風", "癱瘓", "術式", "超載", "治癒", "治療", "破甲", "疊盾", "穿透", "發條", "圍剿", "轉換", "補", "疾病", "燥熱", "清涼", "延命", "銳利", "安可", "業障", "預知", "深眠", "發條", "生命領域", "飢餓幻覺", "暗影", "出血", "預言", "不淨", "屍臭", "增益狀態", "正向狀態", "減益狀態", "負面效果", "負面狀態", "超頻", "當機", "擬像", "專注", "鬆懈", "窒息", "過熟甜瓜", "水壓", "怒目", "降魔", "愛妻便當", "頻率", "行星"];

export function json2string(json: Element | Element[] | undefined): string {
	if (!json) {
		return "";
	}
	if (Array.isArray(json)) {
		return json.map(e => json2string(e)).join('');
	}
	switch (json.type) {
		case "text":
			return json.text as string;

		case "element":
			switch (json.name) {
				case "template":
					const template = compactTemplate(json);
					if (skillinfoKeywords.includes(template.title)) {
						if (template.parts.length > 0) {
							return template.parts[0].value;
						}
						return template.title;
					}
					else if (template.parts.length == 0) {
						return template.title;
					}
					return `{{${template.title}${template.parts.map(p => isNaN(Number(p.name)) ? `|${p.name}=${p.value}` : `|${p.value}`).join('')}}}`;

				case "ignore":
					return "";

				case "ext":
					return "<請至Wiki頁面查看>";

				default:
					if (json.name) {
						if (json.elements) {
							return `<${json.name}>${json2string(json.elements)}</${json.name}>`;
						}
						return `<${json.name}/>`;
					}
					if (json.elements) {
						return json2string(json.elements);
					}
			}
			break;
	}
	return "";
}

//#endregion
