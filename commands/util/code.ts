import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import { Command2 } from "../../typings/discord.js-commando/command";

export default class CodeCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'code',
			group: 'util',
			memberName: 'code',
			description: 'Show argument as code.',
			hidden: true,
		});
	}

	async run2(message: Discord.Message, arg: string) {
		return message.say(`\`${arg}\``);
	}

}
