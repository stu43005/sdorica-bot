import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import { cache } from "../../cache";
import { Command2 } from "../../typings/discord.js-commando/command";
import { Logger } from "../../logger";

export default class ClearCacheCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'clear-cache',
			group: 'owner',
			memberName: 'clear-cache',
			description: '清除所有快取',
			ownerOnly: true,
		});
	}

	async run2(message: Discord.Message) {

		cache.flushAll();
		Logger.log('已清除所有快取');
		return message.say('已清除所有快取');
	}

}
