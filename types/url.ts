import { ArgumentType, CommandoClient } from "discord.js-commando";

const urlRegexp = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)$/;

export default class UrlArgumentType extends ArgumentType {
	constructor(client: CommandoClient) {
		super(client, 'url');
	}

	validate(val: string) {
		if (!urlRegexp.test(val)) {
			return 'Please enter a valid URL.';
		}
		return true;
	}

	parse(val: string) {
		return val;
	}
}
