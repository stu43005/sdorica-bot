import config from "config";
import * as Discord from "discord.js";

export function isDevMode() {
	return config.util.getEnv('NODE_ENV').split(',').includes('development');
}

export function embedOriginUserData(message: Discord.Message, embed?: Discord.MessageEmbed) {
	if (!(embed instanceof Discord.MessageEmbed)) {
		embed = new Discord.MessageEmbed(embed);
	}
	embed.setFooter(message.member ? message.member.displayName : message.author.tag, message.author.displayAvatarURL());
	if (message.member && message.member.displayColor != 0) {
		embed.setColor(message.member.displayColor);
	}
	return embed;
}

export function getOnce<T>(obj: T | T[]): T {
	return obj instanceof Array ? obj[0] : obj;
}

export function showCooldown(message: Discord.Message, time?: number) {
	message.react("⏱");
	message.client.setTimeout(() => {
		unreact(message, "⏱");
	}, (time || config.get('defaultCooldown') || 1) * 1000);
}

export function unreact(message: Discord.Message, emoji: string, user?: Discord.User | Discord.GuildMember | string) {
	const reaction = message.reactions.resolve(emoji);
	if (reaction && message.channel.type !== "dm") {
		reaction.users.remove(user || message.client.user || undefined);
	}
}

export function arrayGroupBy<T>(arr: T[], getter: (value: T) => number, isNumber: true): T[][];
export function arrayGroupBy<T>(arr: T[], getter: (value: T) => string, isNumber?: false): Record<string, T[]>;
export function arrayGroupBy<T>(arr: T[], getter: ((value: T) => number) | ((value: T) => string), isNumber = false): T[][] | Record<string, T[]> {
	if (isNumber) {
		const getter2 = getter as (value: T) => number;
		const out: T[][] = [];
		for (let i = 0; i < arr.length; i++) {
			const item = arr[i];
			const key = getter2(item);
			out[key] = out[key] || [];
			out[key].push(item);
		}
		return out;
	}
	const getter2 = getter as (value: T) => string;
	const out: Record<string, T[]> = {};
	for (let i = 0; i < arr.length; i++) {
		const item = arr[i];
		const key = getter2(item);
		out[key] = out[key] || [];
		out[key].push(item);
	}
	return out;
}

export function arrayConcat<T>(arr: T[], obj: T | T[]): T[] {
	if (obj instanceof Array) {
		return [...arr, ...obj];
	}
	return [...arr, obj];
}

export function isBotOwner(user: Discord.User) {
	return config.get<string[]>('botOwners').indexOf(user.id) >= 0;
}

export function jsonBlock(obj: any) {
	return "```json\n" + JSON.stringify(obj, null, '  ') + "\n```";
}

export function numMultiply(arg1: number, arg2: number): number {
	let m = 0;
	const s1 = arg1.toString(),
		s2 = arg2.toString();
	try {
		m += s1.split(".")[1].length;
	}
	catch (e) { }
	try {
		m += s2.split(".")[1].length;
	}
	catch (e) { }
	return Number(s1.replace(".", "")) * Number(s2.replace(".", "")) / Math.pow(10, m);
}

export function getCustomEmojis(message: Discord.Message) {
	const matchs = message.content.match(/(?:<a?:([a-zA-Z0-9_]+):)([0-9]+)(?:>)/g);
	const ids = matchs?.map(e => e.match(/^(?:<a?:([a-zA-Z0-9_]+):)?([0-9]+)>?$/)?.[2] || '').filter(e => !!e) || [];
	const emojis = (message.guild ?? message.client).emojis.cache.filter(emoji => ids.includes(emoji.id));
	return emojis;
}
