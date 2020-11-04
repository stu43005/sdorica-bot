import * as Discord from "discord.js";
import admin from "firebase-admin";

interface StarboardData {
	starboardMessageId: string;
	senderId: string;
	senderName: string;
	count: number;
}

interface StarboardDataNew {
	messageId: string;
	channelId: string;
	starboardMessageId: string;
	senderId: string;
	senderName: string;
	message: string;
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
	private adding: Record<string, Promise<void>> = {};

	private constructor(private guild: Discord.Guild) {	}

	public async load() {
		const db = admin.firestore();
		const starboardRef = db.collection("starboard").doc(this.guild.id);
		const starboardDoc = await starboardRef.get();
		const temp = starboardDoc.data() as Record<string, string> || {};
		Object.assign(this.temp, temp);
	}

	public async saveItem(item: StarboardDataNew) {
		const db = admin.firestore();
		const starboardRef = db
			.collection("starboard")
			.doc(this.guild.id)
			.collection("messages")
			.doc(item.messageId);
		await starboardRef.set(item, { merge: true });
	}

	public async getItem(message: Discord.Message) {
		const db = admin.firestore();
		const starboardRef = db
			.collection("starboard")
			.doc(this.guild.id)
			.collection("messages")
			.doc(message.id);
		const starboardDoc = await starboardRef.get();
		let result = starboardDoc.data() as StarboardDataNew | undefined;
		if (!result && this.temp[message.id]) {
			result = {
				...this.temp[message.id],
				messageId: message.id,
				channelId: message.channel.id,
				senderId: message.author.id,
				senderName: message.author.tag,
				message: message.content,
			};
		}
		return result;
	}

	public getTemporarilyTimer(message: Discord.Message) {
		return this.adding[message.id] || Promise.resolve();
	}

	public setTemporarilyTimer(message: Discord.Message, timer: Promise<void>) {
		this.adding[message.id] = timer;
		this.guild.client.setTimeout(() => {
			delete this.adding[message.id];
		}, 10000);
	}

	public async addStarboardMessage(message: Discord.Message, count: number, starboardMessage: Discord.Message) {
		const newdata: StarboardDataNew = {
			messageId: message.id,
			channelId: message.channel.id,
			starboardMessageId: starboardMessage.id,
			senderId: message.author.id,
			senderName: message.author.tag,
			message: message.content,
			count,
		};
		delete this.adding[message.id];
		await this.saveItem(newdata);
	}

}
