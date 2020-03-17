import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import { Command2 } from "../../typings/discord.js-commando/command";
import { StatCollection } from "../../stat-collection";

export default class StatCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'stat',
			group: 'owner',
			memberName: 'stat',
			description: '還沒有要幹嘛',
			ownerOnly: true,
		});

		this.initHooks(client);
	}

	async run2(message: Discord.Message) {
		return null;
	}

	initHooks(client: CommandoClient) {
		client.on('message', (message: Discord.Message) => {
			if (message.author.bot) return;
			if (!message.guild) return;
			StatCollection.fromGuild(message.guild).addMessage(message);
		});

		client.on('messageReactionAdd', (messageReaction: Discord.MessageReaction, user: Discord.User) => {
			if (user.bot) return;
			const guild = messageReaction.message.guild;
			if (!guild) return;
			StatCollection.fromGuild(guild).addReaction(messageReaction, user);
		});

		client.on("guildMemberAdd", (member: Discord.GuildMember) => {
			StatCollection.fromGuild(member.guild).memberChange();
		});

		client.on("guildMemberRemove", (member: Discord.GuildMember) => {
			StatCollection.fromGuild(member.guild).memberChange();
		});
	}

}
