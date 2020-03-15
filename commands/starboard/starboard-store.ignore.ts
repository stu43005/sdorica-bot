import * as Discord from "discord.js";
import admin from "firebase-admin";
import { Subject } from "rxjs";
import { auditTime } from "rxjs/operators";

interface StarboardData {
	starboardMessageId: string;
	senderId: string;
	senderName: string;
	count: number;
}

export class StarboardStore {
	private static guilds: { [guildId: string]: StarboardStore } = {};

	public static async fromGuild(guild: Discord.Guild) {
		if (!this.guilds[guild.id]) {
			this.guilds[guild.id] = new StarboardStore(guild);
			await this.guilds[guild.id].load();
		}
		return this.guilds[guild.id];
	}

	private temp: Record<string, StarboardData> = {};
	private adding: Record<string, Promise<Discord.Message | Discord.Message[]>> = {};
	private update$ = new Subject<void>();

	private constructor(private guild: Discord.Guild) {
		this.update$.pipe(
			auditTime(60 * 1000)
		).subscribe(() => {
			this.save();
		});
	}

	public async save() {
		const db = admin.firestore();
		const starboardRef = db.collection("starboard").doc(this.guild.id);
		await starboardRef.set(this.temp, { merge: true });
		await this.load();
	}

	public async load() {
		const db = admin.firestore();
		const starboardRef = db.collection("starboard").doc(this.guild.id);
		const starboardDoc = await starboardRef.get();
		const temp = starboardDoc.data() as Record<string, string> || {};
		Object.assign(this.temp, temp);
	}

	public getTemporarilyTimer(message: Discord.Message) {
		return this.adding[message.id] || Promise.resolve();
	}

	public setTemporarilyTimer(message: Discord.Message, timer: Promise<Discord.Message | Discord.Message[]>) {
		this.adding[message.id] = timer;
		this.guild.client.setTimeout(() => {
			delete this.adding[message.id];
		}, 10000);
	}

	public getStarboardMessage(message: Discord.Message) {
		return this.temp[message.id];
	}

	public addStarboardMessage(message: Discord.Message, count: number, starboardMessage: Discord.Message) {
		this.temp[message.id] = {
			starboardMessageId: starboardMessage.id,
			senderId: message.author.id,
			senderName: message.author.tag,
			count,
		};
		delete this.adding[message.id];
		this.update$.next();
	}

	public updateCount(message: Discord.Message, count: number) {
		if (this.temp[message.id]) {
			this.temp[message.id].count = count;
			delete this.adding[message.id];
		}
	}
}
