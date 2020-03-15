import { ArgumentType, CommandoClient } from "discord.js-commando";

export default class SnowflakeArgumentType extends ArgumentType {
	constructor(client: CommandoClient) {
		super(client, 'snowflake');
	}

	validate(val: string) {
		if (!/^[0-9]+$/.test(val)) return false;
		return true;
	}

	parse(val: string) {
		return val;
	}
}
