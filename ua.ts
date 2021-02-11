import config from 'config';
import { PartialUser, User } from 'discord.js';
import fetch from 'node-fetch';
import { v4 as uuid } from 'uuid';
import { Logger } from './logger';
import { isDevMode } from './utils';

const clientId = uuid();

export function getVisitor(user: User | PartialUser): Visitor {
	return new Visitor(config.get('measurementProtocol.measurementId'), config.get('measurementProtocol.apiSecret'), user.id);
}

interface Event {
	name: string;
	params: Record<string, any>;
}

export class Visitor {
	private queue: Event[] = [];

	constructor(
		private measurementId: string,
		private apiSecret: string,
		private userId: string,
	) {	}

	event(name: string, params: Record<string, any>) {
		const event: Event = {
			name,
			params,
		};
		this.queue.push(event);
		return this;
	}

	exception(description: string, fatal: boolean) {
		return this.event('exception', {
			description,
			fatal,
		});
	}

	async send() {
		if (!this.measurementId || !this.apiSecret) return;

		const debug = isDevMode() ? 'debug/' : '';
		const url = `https://www.google-analytics.com/${debug}mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`;

		try {
			while (this.queue.length > 0) {
				const events = this.queue.splice(0, Math.min(this.queue.length, 25));
				const body = {
					client_id: clientId,
					userId: this.userId,
					events,
				};
				const res = await fetch(url, {
					method: "POST",
					body: JSON.stringify(body),
				});
				if (isDevMode()) {
					const json = await res.json();
					Logger.debug('[Visitor]', json);
				}
			}
		} catch (error) {
			Logger.error('[Visitor]', error);
		}
	}

}
