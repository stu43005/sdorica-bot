import { CronJob } from "cron";
import { Client } from "discord.js-commando";
import admin from "firebase-admin";
import moment from "moment";
import { mergeData } from "../stat-collection";

async function job(lastday: moment.Moment) {
	const lastweek = lastday.format('GGGG-[W]WW');
	const db = admin.firestore();
	const statSnapshot = await db.collection("stat").get();

	for (let i = 0; i < statSnapshot.docs.length; i++) {
		const doc = statSnapshot.docs[i];
		const guildId = doc.id;

		const weeklyRef = db.collection('stat').doc(guildId).collection('weekly').doc(lastweek);
		const weeklySnapshot = await weeklyRef.get();
		if (!weeklySnapshot.exists) {
			const data: any = {
				days: [],
			};
			for (let i = 1; i <= 7; i++) {
				const day = lastday.isoWeekday(i).format('YYYY-MM-DD');
				const dayRef = db.collection('stat').doc(guildId).collection('daily').doc(day);
				const daySnapshot = await dayRef.get();
				const dayData = daySnapshot.data() as any;
				if (dayData) {
					mergeData(data, dayData);
					data.days.push(day);
				}
			}
			weeklyRef.set(data);
		}
	}
}

async function oldData() {
	let day = moment();
	for (let i = 0; i < 15; i++) {
		day = day.subtract(7, 'days');
		await job(day);
	}
}
// oldData();

// At 00:00
export default function (client: Client) {
	return new CronJob('0 0 * * *', () => {
		const lastday = moment().subtract(7, 'days');
		job(lastday);
	});
}
