import { Message } from 'discord.js';

declare module 'discord.js-commando' {
	interface ArgumentCollector {
		obtain(msg: CommandoMessage | Message, provided?: any[], promptLimit?: number): Promise<ArgumentCollectorResult>;
	}
}
