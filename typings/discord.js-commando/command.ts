import * as Discord from "discord.js";
import { Command, CommandoMessage, ArgumentCollectorResult } from "discord.js-commando";

export class Command2 extends Command {
	run(message: CommandoMessage, args: object | string | string[], fromPattern: boolean, result?: ArgumentCollectorResult) {
		const message2 = message as Discord.Message;
		return this.run2(message2, args, fromPattern, result);
	}

	run2(message: Discord.Message, args: object | string | string[], fromPattern: boolean, result?: ArgumentCollectorResult): Promise<Discord.Message | Discord.Message[] | null> | null {
		throw new Error(`${this.constructor.name} doesn't have a run() method.`);
	}
}
