import { codeBlock } from '@discordjs/builders';
import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import { Command2 } from "../../typings/discord.js-commando/command";

export default class SnowflakeCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'snowflake',
			group: 'util',
			memberName: 'snowflake',
			description: 'Gets information about a snowflake.',
			examples: ['snowflake 198437688255184897'],
			hidden: true,

			args: [
				{
					key: 'snowflake',
					prompt: 'snowflake?',
					type: 'string',
				}
			],
		});
	}

	async run2(message: Discord.Message, args: any) {

		const snowflake = Discord.SnowflakeUtil.deconstruct(args.snowflake);
		return message.say(codeBlock('fix', `timestamp: ${snowflake.timestamp}
date: ${snowflake.date.toISOString()}
workerID: ${snowflake.workerID}
processID: ${snowflake.processID}
increment: ${snowflake.increment}`));
	}

}
