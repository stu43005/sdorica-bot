import * as Discord from "discord.js";

function now() {
	return Math.floor(new Date().getTime() / 1000);
}

export class Cooldown {
	public tokens: number;
	public window = 0;
	public last = 0;

	constructor(
		public rate: number,
		public per: number,
		public type: BucketType,
	) {
		this.tokens = this.rate;
	}

	getTokens(current: number = now()) {
		let tokens = this.tokens;
		if (current > this.window + this.per) {
			tokens = this.rate;
		}
		return tokens;
	}

	updateRateLimit() {
		const current = now();
		this.last = current;

		this.tokens = this.getTokens(current);

		// first token used means that we start a new rate limit window
		if (this.tokens == this.rate) {
			this.window = current;
		}

		// check if we are rate limited
		if (this.tokens == 0) {
			return this.per - (current - this.window);
		}

		// we're not so decrement our tokens
		this.tokens -= 1;

		// see if we got rate limited due to this token change, and if
		// so update the window to point to our current time frame
		if (this.tokens == 0) {
			this.window = current;
		}
	}

	reset() {
		this.tokens = this.rate;
		this.last = 0;
	}

	clone() {
		return new Cooldown(this.rate, this.per, this.type);
	}

	toString() {
		return `<Cooldown rate: ${this.rate} per: ${this.per} window: ${this.window} tokens: ${this.tokens}>`;
	}
}

export class CooldownMapping {
	private cache: { [key: string]: Cooldown } = {};

	constructor(public cooldown: Cooldown) { }

	clone() {
		const ret = new CooldownMapping(this.cooldown);
		ret.cache = Object.assign({}, this.cache);
		return ret;
	}

	get valid() {
		return this.cooldown !== null;
	}

	static fromCooldown(rate: number, per: number, type: BucketType) {
		return new CooldownMapping(new Cooldown(rate, per, type));
	}

	private bucketKey(message: Discord.Message) {
		const bucketType = this.cooldown.type;
		switch (bucketType) {
			case BucketType.user:
				return message.author.id;
			case BucketType.guild:
				return (message.guild || message.author).id;
			case BucketType.channel:
				return message.channel.id;
			case BucketType.member:
				return `${message.guild && message.guild.id},${message.author.id}`;
			case BucketType.category:
				return ((message.channel as Discord.GuildChannel).parent || message.channel).id;
		}
		return "default";
	}

	private verifyCacheIntegrity() {
		// we want to delete all cache objects that haven't been used
		// in a cooldown window.e.g.if we have a  command that has a
		// cooldown of 60s and it has not been used in 60s then that key should be deleted
		const current = now();
		const deadKeys: string[] = [];
		for (const key in this.cache) {
			if (this.cache.hasOwnProperty(key)) {
				const value = this.cache[key];
				if (current > value.last + value.per) {
					deadKeys.push(key);
				}
			}
		}
		deadKeys.forEach(key => {
			delete this.cache[key];
		});
	}

	getBucket(message: Discord.Message) {
		if (this.cooldown.type == BucketType.default) {
			return this.cooldown;
		}

		this.verifyCacheIntegrity();
		const key = this.bucketKey(message);
		let bucket: Cooldown;
		if (!this.cache[key]) {
			bucket = this.cooldown.clone();
			this.cache[key] = bucket;
		}
		else {
			bucket = this.cache[key];
		}

		return bucket;
	}
}

export enum BucketType {
	default = 0,
	user = 1,
	guild = 2,
	channel = 3,
	member = 4,
	category = 5,
}
