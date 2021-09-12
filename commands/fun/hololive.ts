import config from 'config';
import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import moment from 'moment-timezone';
import fetch, { FetchError } from "node-fetch";
import { Logger } from "../../logger";
import { Command2 } from "../../typings/discord.js-commando/command";

const defaultUrl = 'https://www.youtube.com/channel/UCJFZiqLMntJufDCHc6bQixg';

interface Calendar {
	name: string;
	email: string;
	emoji: string;
	url: string;
}
interface CalendarSet {
	names: string[];
	calendars: Calendar[];
}

const calendarSets: CalendarSet[] = [
	{
		"names": ["global"],
		"calendars": [
			{
				name: 'Special Events',
				email: 'ftq5ih30ut46um067egvhk2ogg@group.calendar.google.com',
				emoji: '📺',
				url: defaultUrl,
			},
			{
				name: 'Collab',
				email: 'nukdt8rlsvnl2r27cs2k0qmk7g@group.calendar.google.com',
				emoji: '🤝',
				url: defaultUrl,
			}
		]
	},
	{
		"names": ["en", "en1", "myth"],
		"calendars": [
			{
				name: 'Kiara',
				email: 'esr14js9tnkc23tmee4bv3noso@group.calendar.google.com',
				emoji: '🐔',
				url: 'https://www.youtube.com/channel/UCHsx4Hqa-1ORjQTh9TYDhww',
			},
			{
				name: 'Calliope',
				email: 'h1l6g3fk72huhetaas49t094kc@group.calendar.google.com',
				emoji: '💀',
				url: 'https://www.youtube.com/channel/UCL_qhgtOy0dy1Agp8vkySQg',
			},
			{
				name: 'Amelia',
				email: '3e09hfa3b4qtq8igs2e8973qic@group.calendar.google.com',
				emoji: '🔎',
				url: 'https://www.youtube.com/channel/UCyl1z3jo3XHR1riLFKG5UAg',
			},
			{
				name: 'Gura',
				email: 'tt4vh2ie475i52m3r5kg01p0ms@group.calendar.google.com',
				emoji: '🔱',
				url: 'https://www.youtube.com/channel/UCoSrY_IQQVpmIRZ9Xf-y93g',
			},
			{
				name: 'Ina',
				email: '5mtio9o9dv8asotsgmhri8k41c@group.calendar.google.com',
				emoji: '🐙',
				url: 'https://www.youtube.com/channel/UCMwGHR0BTZuLsmjY_NT5Pwg',
			},
		]
	},
	{
		"names": ["en", "en2", "hope"],
		"calendars": [
			{
				"email": "b31bqpsio3di6abnf0s50jcrbo@group.calendar.google.com",
				"name": "IRyS",
				"emoji": "💎",
				"url": "https://www.youtube.com/channel/UC8rcEBzJSleTkf_-agPM20g"
			},
		]
	},
	{
		"names": ["en", "en2", "council"],
		"calendars": [
			{
				"email": "o4as7svvgli48cvqlv4braourg@group.calendar.google.com",
				"name": "Fauna",
				"emoji": "🌿",
				"url": "https://www.youtube.com/channel/UCO_aKKYxn4tvrqPjcTzZ6EQ"
			},
			{
				"email": "b3n603rhe2in4gifmqqp75rkl0@group.calendar.google.com",
				"name": "Sana",
				"emoji": "🪐",
				"url": "https://www.youtube.com/channel/UCsUj0dszADCGbF3gNrQEuSQ"
			},
			{
				"email": "c1m1lu1upcjvmga16lvgi6icqk@group.calendar.google.com",
				"name": "Kronii",
				"emoji": "⏳",
				"url": "https://www.youtube.com/channel/UCmbs8T6MWqUHP1tIQvSgKrg"
			},
			{
				"email": "t6f1k97lo7actv3s8aofhjqn3g@group.calendar.google.com",
				"name": "Mumei",
				"emoji": String.fromCodePoint(0x1FAB6),
				"url": "https://www.youtube.com/channel/UC3n5uGu18FoCy23ggWWp8tA"
			},
			{
				"email": "rplfu1c7ocspap768i24082dro@group.calendar.google.com",
				"name": "Baelz",
				"emoji": "🎲",
				"url": "https://www.youtube.com/channel/UCgmPnx-EEeOrZSg5Tiw7ZRQ"
			},
		]
	},
	{
		"names": ["id", "id1"],
		"calendars": [
			{
				name: 'Risu',
				email: 'mdj5d3qe7bi82a47c6dl2bedb4@group.calendar.google.com',
				emoji: '🐿',
				url: 'https://www.youtube.com/channel/UCOyYb1c43VlX9rc_lT6NKQw',
			},
			{
				name: 'Iofi',
				email: 'b3q7c9f1gupe09h3om6sns32mg@group.calendar.google.com',
				emoji: '🎨',
				url: 'https://www.youtube.com/channel/UCAoy6rzhSf4ydcYjJw3WoVg',
			},
			{
				name: 'Moona',
				email: '87jujgdf4sgm0s6h120r6rg7mo@group.calendar.google.com',
				emoji: '🔮',
				url: 'https://www.youtube.com/channel/UCP0BspO_AMEe3aQqqpo89Dg',
			},
		]
	},
	{
		"names": ["id", "id2"],
		"calendars": [
			{
				name: 'Ollie',
				email: 't10hn2eqnoehcq8r82lot4ij1g@group.calendar.google.com',
				emoji: '🧟‍♀️',
				url: 'https://www.youtube.com/channel/UCYz_5n-uDuChHtLo7My1HnQ',
			},
			{
				name: 'Melfissa',
				email: 'c10lptp72vs5rdfmf36f67u1j4@group.calendar.google.com',
				emoji: '🍂',
				url: 'https://www.youtube.com/channel/UChgTyjG-pdNvxxhdsXfHQ5Q',
			},
			{
				name: 'Reine',
				email: '01scep9nhn0i2amh4e8o1n4imk@group.calendar.google.com',
				emoji: '🦚',
				url: 'https://www.youtube.com/channel/UC727SQYUvx5pDDGQpTICNWg',
			},
		]
	},
];

const validGroups = [...new Set(calendarSets.flatMap(set => set.names))];

export default class HololiveCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'hololive',
			aliases: ["holo"],
			group: 'fun',
			memberName: 'hololive',
			description: 'Hololive upcoming stream schedule',
			throttling: {
				usages: 1,
				duration: 5,
			},

			args: [
				{
					key: 'group',
					type: 'string',
					prompt: 'group?',
					oneOf: validGroups,
					default: 'en',
				},
			],
		});
	}

	async run2(message: Discord.Message, { group }: { group: string }) {
		if (!config.has('googleCalendarApiKey')) {
			// disabled command
			return null;
		}
		try {
			const key = config.get<string>('googleCalendarApiKey');
			const timeMin = moment().toISOString();
			const timeMax = moment().add(1.5, 'day').toISOString();

			const matchSets = ['global', group].flatMap(g => calendarSets.filter(set => set.names.includes(g.toLowerCase())));
			const calendars = matchSets.flatMap(set => set.calendars);
			Logger.debug('[hololive] calendars:', calendars.map(c => c.name));

			const urls = calendars.map(calendar => `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.email)}/events?key=${encodeURIComponent(key)}&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&maxResults=9999`);
			const jsons = await Promise.all<CalendarData>(urls.map(url => fetch(url).then(res => res.json()).catch(error => {
				Logger.error('[hololive]', error);
				return null;
			})));

			const events = jsons.reduce<EventItem[]>((acc, cur) => {
				if (!cur) return acc;
				return acc.concat(cur.items);
			}, []).sort((a, b) => {
				return new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime();
			});

			const desc = events.map(event => {
				const calendar = calendars.find(cal => cal.email === event.organizer.email);
				const emoji = calendar?.emoji ?? '▶️';
				const url = event.location ? `[stream link](${event.location})` : `[channel link](${calendar?.url ?? defaultUrl})`;
				const startTime = moment(event.start.dateTime).tz('Asia/Taipei').calendar();
				return `${emoji} [${startTime}] ${event.summary} ${url}`;
			}).join('\n');

			const embed = new Discord.MessageEmbed();
			embed.setTitle('Hololive stream schedule');
			embed.setURL(`https://stream-calendar.vercel.app/`);
			embed.setDescription(desc);
			return await message.say(embed);

		} catch (error) {
			if (!(error instanceof FetchError)) {
				Logger.error('[hololive]', error);
			}
		}
		return null;
	}

}

export interface CalendarData {
	kind: string;
	etag: string;
	summary: string;
	description: string;
	updated: string;
	timeZone: string;
	accessRole: string;
	defaultReminders: any[];
	nextSyncToken: string;
	items: EventItem[];
}

export interface EventItem {
	kind: string;
	etag: string;
	id: string;
	status: string;
	htmlLink: string;
	created: string;
	updated: string;
	summary: string;
	location?: string;
	creator: Creator;
	organizer: Organizer;
	start: Time;
	end: Time;
	iCalUID: string;
	sequence: number;
}

export interface Creator {
	email: string;
}

export interface Time {
	dateTime: string;
}

export interface Organizer {
	email: string;
	displayName: string;
	self: boolean;
}
