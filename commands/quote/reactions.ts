import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import { Command2 } from "../../typings/discord.js-commando/command";
import { quoteEmbed } from "./quote";

const REACTION_QUOTE_EMOJI = '💬';
const key = 'quoteOnReaction';

export default class QuoteReactionsCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'quote-reactions',
			group: 'quote',
			aliases: ['qreactions'],
			memberName: 'quote-reactions',
			description: '設定是否可以通過反應💬(`:speech_balloon:`)表情來快速引用',
			guildOnly: true,
			userPermissions: ['MANAGE_GUILD'],
		});

		client.on('messageReactionAdd', async (messageReaction: Discord.MessageReaction, user: Discord.User) => {
			if (user.bot) { return; }
			const message = messageReaction.message;
			const guild = message.guild;
			if (!guild) { return; }
			if (!this.isEnabledIn(guild)) return;

			if (messageReaction.emoji.name == REACTION_QUOTE_EMOJI && guild.settings.get(key)) {
				const member = guild.members.resolve(user);
				if (!member) { return; }
				const channel = message.channel;
				if (!channel) { return; }

				if (member.permissionsIn(channel).has('SEND_MESSAGES')) {
					if (message.partial) await message.fetch();
					await quoteEmbed(channel, message, user);
				}
			}
		});
	}

	async run2(message: Discord.Message) {
		if (!message.guild) return null;

		const value = message.guild.settings.get(key);
		if (!value) {
			await message.guild.settings.set(key, true);
			return await message.say('✅ **Quoting messages on reaction enabled.**');
		}
		else {
			await message.guild.settings.set(key, false);
			return await message.say('✅ **Quoting messages on reaction disabled.**');
		}
	}

}
