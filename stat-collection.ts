import dateFormat from 'dateformat';
import * as Discord from "discord.js";
import admin from "firebase-admin";
import { Subject } from "rxjs";
import { auditTime } from "rxjs/operators";
import { Logger } from "./logger";
import { objectEach } from "./utils";

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
	private voiceTime: Record<string, number> = {};
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
			objectEach(newmeta.channelNames, (key, value) => {
				meta.channelNames[key] = value;
			});
			objectEach(newmeta.userNames, (key, value) => {
				meta.userNames[key] = value;
			});
		}
		metaRef.set(meta, { merge: true });

		const dateStr = dateFormat(new Date(), "yyyy-mm-dd");
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
		this.temp.messages = (this.temp.messages || 0) + 1;
		if (!this.temp.messagesByMember) this.temp.messagesByMember = {};
		this.temp.messagesByMember[message.author.id] = (this.temp.messagesByMember[message.author.id] || 0) + 1;
		if (!this.temp.messagesByChannel) this.temp.messagesByChannel = {};
		this.temp.messagesByChannel[message.channel.id] = (this.temp.messagesByChannel[message.channel.id] || 0) + 1;

		this.meta.userNames[message.author.id] = message.author.tag;
		this.meta.channelNames[message.channel.id] = (message.channel as Discord.TextChannel).name;

		this.update$.next();
	}

	addMeme(message: Discord.Message, meme: string) {
		if (!this.temp.memes) this.temp.memes = {};
		this.temp.memes[meme] = (this.temp.memes[meme] || 0) + 1;

		this.update$.next();
	}

}

function mergeData(base: StatData, temp: StatData) {
	base.members = temp.members;

	if (temp.messages) base.messages = (base.messages || 0) + temp.messages;

	mergeRecordData(base, temp, 'messagesByMember');
	mergeRecordData(base, temp, 'messagesByChannel');
	mergeRecordData(base, temp, 'memes');
}

function mergeRecordData(base: StatData, temp: StatData, type: string) {
	if (temp[type]) {
		if (!base[type]) base[type] = {};
		objectEach(temp[type], (key, value) => {
			base[type][key] = (base[type][key] || 0) + value;
		});
	}
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
	messagesByChannel?: Record<string, number>;

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
	voice: number,
	voiceByMember: {
		[userId: string]: number,
	},
	voiceByChannel: {
		[channelId: string]: number,
	},
}

*/
