import * as Discord from "discord.js";
import admin from "firebase-admin";
import moment from 'moment';
import { Subject } from "rxjs";
import { auditTime } from "rxjs/operators";
import { Logger } from "./logger";
import { getCustomEmojis } from "./utils";

export class StatCollection {
	private static guilds: { [guildId: string]: StatCollection } = {};

	public static fromGuild(guild: Discord.Guild) {
		if (!this.guilds[guild.id]) {
			this.guilds[guild.id] = new StatCollection(guild);
		}
		return this.guilds[guild.id];
	}

	private meta: StatGuild;
	private temp: StatData;
	private update$ = new Subject<void>();

	constructor(private guild: Discord.Guild) {
		this.temp = {
			members: guild.memberCount,
		};
		this.meta = {
			userNames: {},
			channelNames: {},
		};

		this.update$.pipe(
			auditTime(60 * 1000)
		).subscribe(() => {
			this.save();
		});

		this.update$.next();
	}

	async save() {
		const newmeta = this.meta;
		const temp = this.temp;
		this.newTemp();

		Logger.debug(`save stat ${this.guild.id}: ${JSON.stringify(temp)}`);
		const db = admin.firestore();
		const metaRef = db.collection("stat").doc(this.guild.id);
		const metaDoc = await metaRef.get();
		let meta = metaDoc.data() as StatGuild;
		if (!metaDoc.exists || !meta) {
			meta = newmeta;
		}
		else {
			Object.keys(newmeta.channelNames).forEach(key => {
				meta.channelNames[key] = newmeta.channelNames[key];
			});
			Object.keys(newmeta.userNames).forEach(key => {
				meta.userNames[key] = newmeta.userNames[key];
			});
		}
		metaRef.set(meta, { merge: true });

		const dateStr = moment().format('YYYY-MM-DD');
		const dailyRef = metaRef.collection("daily").doc(dateStr);
		const dailyDoc = await dailyRef.get();
		let daily = dailyDoc.data() as StatData;
		if (!dailyDoc.exists || !daily) {
			daily = temp;
		}
		else {
			mergeData(daily, temp);
		}
		dailyRef.set(daily, { merge: true });
	}

	newTemp() {
		const prev = this.temp;
		this.temp = {
			members: prev.members,
		};
		this.meta = {
			userNames: {},
			channelNames: {},
		};
	}

	memberChange() {
		if (this.temp.members != this.guild.memberCount) {
			this.temp.members = this.guild.memberCount;
			this.update$.next();
		}
	}

	addMessage(message: Discord.Message) {
		if (!this.temp.messagesByMember) this.temp.messagesByMember = {};
		if (!this.temp.messagesByChannel) this.temp.messagesByChannel = {};
		if (!this.temp.messagesByMemberByChannel) this.temp.messagesByMemberByChannel = {};
		if (!this.temp.messagesByMemberByChannel[message.author.id]) this.temp.messagesByMemberByChannel[message.author.id] = {};

		add(this.temp, 'messages');
		add(this.temp.messagesByMember, message.author.id);
		add(this.temp.messagesByMemberByChannel[message.author.id], message.channel.id);
		add(this.temp.messagesByChannel, message.channel.id);

		const emojis = getCustomEmojis(message);
		emojis.forEach(emoji => {
			if (!this.temp.emojis) this.temp.emojis = {};
			if (!this.temp.emojisByMember) this.temp.emojisByMember = {};
			if (!this.temp.emojisByMember[message.author.id]) this.temp.emojisByMember[message.author.id] = {};

			add(this.temp.emojis, emoji.id);
			add(this.temp.emojisByMember[message.author.id], emoji.id);
		});

		this.meta.userNames[message.author.id] = message.author.tag;
		this.meta.channelNames[message.channel.id] = (message.channel as Discord.TextChannel).name;

		this.update$.next();
	}

	addReaction(messageReaction: Discord.MessageReaction, user: Discord.User) {
		if (messageReaction.emoji.id) {
			if (!this.temp.reactions) this.temp.reactions = {};
			if (!this.temp.reactionsByMember) this.temp.reactionsByMember = {};
			if (!this.temp.reactionsByMember[user.id]) this.temp.reactionsByMember[user.id] = {};

			add(this.temp.reactions, messageReaction.emoji.id);
			add(this.temp.reactionsByMember[user.id], messageReaction.emoji.id);
		}
	}

	addMeme(message: Discord.Message, meme: string) {
		if (!this.temp.memes) this.temp.memes = {};
		add(this.temp.memes, meme);

		this.update$.next();
	}

}

export function mergeData(base: StatData, temp: StatData) {
	base.members = temp.members;

	if (temp.messages) base.messages = (base.messages || 0) + temp.messages;

	mergeRecordData(base, temp, 'messagesByMember');
	mergeDoubleRecordData(base, temp, 'messagesByMemberByChannel');
	mergeRecordData(base, temp, 'messagesByChannel');
	mergeRecordData(base, temp, 'emojis');
	mergeDoubleRecordData(base, temp, 'emojisByMember');
	mergeRecordData(base, temp, 'reactions');
	mergeDoubleRecordData(base, temp, 'reactionsByMember');
	mergeRecordData(base, temp, 'memes');
}

function mergeRecordData(base: StatData, temp: StatData, type: string) {
	if (temp[type]) {
		if (!base[type]) base[type] = {};
		Object.keys(temp[type]).forEach(key => {
			add(base[type], key, temp[type][key]);
		});
	}
}

function mergeDoubleRecordData(base: StatData, temp: StatData, type: string) {
	if (temp[type]) {
		if (!base[type]) base[type] = {};
		Object.keys(temp[type]).forEach(key => {
			mergeRecordData(base[type], temp[type], key);
		});
	}
}

function add(obj: object, key: string, value = 1) {
	obj[key] = (obj[key] || 0) + value;
}


interface StatGuild {
	userNames: {
		[userId: string]: string,
	};
	channelNames: {
		[channelId: string]: string,
	};
}

interface StatData {
	members: number;

	messages?: number;
	messagesByMember?: Record<string, number>;
	messagesByMemberByChannel?: Record<string, Record<string, number>>;
	messagesByChannel?: Record<string, number>;
	emojis?: Record<string, number>;
	emojisByMember?: Record<string, Record<string, number>>;

	reactions?: Record<string, number>;
	reactionsByMember?: Record<string, Record<string, number>>;

	memes?: Record<string, number>;

}

/*

/stat/{guildId}
{
	userNames: {
		[userId: string]: string,
	},
	channelNames: {
		[channelId: string]: string,
	},
}

/stat/{guildId}/daily/{date}
{
	members: number,
	messages: number,
	messagesByMember: {
		[userId: string]: number,
	},
	messagesByChannel: {
		[channelId: string]: number,
	},
}

*/
