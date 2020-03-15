import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import { Command2 } from "../../typings/discord.js-commando/command";
import { quoteEmbed } from "./quote";

const snipes = new Discord.Collection<Discord.Snowflake, Discord.Collection<Discord.Snowflake, Discord.Message>>();

export default class SnipeCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'snipe',
			group: 'quote',
			memberName: 'snipe',
			description: '顯示最後刪除的訊息',
			details: '經常看到頻道有未讀訊息，然後在哪裡找不到任何新訊息嗎？本指令允許擁有『管理訊息』權限的使用者，檢查頻道中最後刪除的訊息',
			examples: ['snipe', 'snipe #myChannel'],
			guildOnly: true,
		});

		client.on("guildDelete", (guild: Discord.Guild) => {
			snipes.delete(guild.id);
		});

		client.on("channelDelete", (channel: Discord.Channel) => {
			const guildChannel = channel as Discord.GuildChannel;
			const guildSnipes = guildChannel.guild ? snipes.get(guildChannel.guild.id) : undefined;
			if (guildSnipes) {
				guildSnipes.delete(channel.id);
			}
		});

		client.on("messageDelete", (message: Discord.Message) => {
			if (message.guild && !message.author.bot) {
				let guildSnipes = snipes.get(message.guild.id);
				if (!guildSnipes) {
					guildSnipes = new Discord.Collection<Discord.Snowflake, Discord.Message>();
					snipes.set(message.guild.id, guildSnipes);
				}
				guildSnipes.set(message.channel.id, message);
			}
		});
	}

	async run2(message: Discord.Message) {

		let channel = message.channel as Discord.TextChannel;
		if (message.mentions && message.mentions.channels.size > 0) {
			channel = message.mentions.channels.array()[0];
		}

		const permissions = channel.permissionsFor(message.author);
		if (!permissions || !permissions.has("MANAGE_MESSAGES") || !permissions.has("VIEW_CHANNEL") || !permissions.has("READ_MESSAGE_HISTORY")) {
			return null;
		}

		const guildSnipes = snipes.get(channel.guild.id);
		if (guildSnipes) {
			const deletedMessage = guildSnipes.get(channel.id);
			if (deletedMessage) {
				return await quoteEmbed(message.channel, deletedMessage, message.author, "Sniped");
			}
		}
		return await message.say('❎ **No available messages.**');
	}

}
