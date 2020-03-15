import config from "config";
import NodeCache from 'node-cache';

class MyCache extends NodeCache {
	async getOrFetch<T>(setting: string, fetch: () => T | Promise<T>, ttl?: number | string): Promise<T> {
		let value = this.get<T>(setting);
		if (!value) {
			value = await fetch();
			if (ttl) {
				this.set(setting, value, ttl);
			} else {
				this.set(setting, value);
			}
		}
		return value;
	}
}

export const cache = new MyCache({
	stdTTL: config.get('cacheTTL'),
	useClones: false,
});
