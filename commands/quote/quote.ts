import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import { Command2 } from "../../typings/discord.js-commando/command";

export default class QuoteCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'quote',
			aliases: ["q"],
			group: 'quote',
			memberName: 'quote',
			description: '使用此指令引用一則訊息',
			examples: ['quote 603983888141778954', 'q 603983975634960404 Your reply'],
			patterns: [/^>q(uote)? (\d+)/],
			guildOnly: true,
			throttling: {
				usages: 2,
				duration: 5,
			},
			argsType: 'multiple',
		});

		client.on('message', async (message: Discord.Message) => {
			if (message.author.bot) return;
			if (message.guild && !this.isEnabledIn(message.guild)) return;

			const strs = message.content.split(/\s+/);
			for (let i = 0; i < strs.length; i++) {
				let word = strs[i].toLowerCase().replace(/^<|>$/g, "");
				if (word.startsWith('https://canary.discordapp.com/channels/')) {
					word = word.slice('https://canary.discordapp.com/channels/'.length);
				}
				else if (word.startsWith('https://ptb.discordapp.com/channels/')) {
					word = word.slice('https://ptb.discordapp.com/channels/'.length);
				}
				else if (word.startsWith('https://discordapp.com/channels/')) {
					word = word.slice('https://discordapp.com/channels/'.length);
				}
				else {
					continue;
				}

				const listIds = word.split('/');
				if (listIds.length == 3) {
					const channel = client.channels.cache.get(listIds[1]);
					if (!channel) {
						continue;
					}

					if (channel.type === 'text') {
						const msgId = listIds[2];
						if (isNaN(Number(msgId))) {
							continue;
						}

						try {
							const msgFound = await (channel as Discord.TextChannel).messages.fetch(msgId);
							await quoteEmbed(message.channel, msgFound, message.author, "Linked");
						} catch (error) {
							continue;
						}
					}
				}
			}
		});
	}

	async run2(message: Discord.Message, args: string[]) {

		if (args[0].startsWith(">q")) {
			args.shift();
			args.shift();
		}

		let quoteMessage: Discord.Message | null = null;
		try {
			quoteMessage = await message.channel.messages.fetch(args[0]);
		} catch (error) {
			if (message.guild) {
				const textChannels = message.guild.channels.cache.filter(c => c.type == "text").array() as Discord.TextChannel[];
				for (let i = 0; i < textChannels.length; i++) {
					const channel = textChannels[i];
					const perms = message.guild.me?.permissionsIn(channel);
					if (channel.id == message.channel.id || !perms || !perms.has("VIEW_CHANNEL") || !perms.has("READ_MESSAGE_HISTORY")) {
						continue;
					}

					try {
						quoteMessage = await channel.messages.fetch(args[0]);
						break;
					} catch (error2) {
					}
				}
			}
		}

		if (quoteMessage) {
			const sendedMessages = await quoteEmbed(message.channel, quoteMessage, message.author);

			const reply = message.content.substr(message.content.indexOf(quoteMessage.id) + quoteMessage.id.length).trim();
			if (reply) {
				sendedMessages.push(await message.channel.send(`**${message.member ? message.member.displayName : message.author.tag}'s reply:**\n${reply.replace('@everyone', '@еveryone').replace('@here', '@hеre')}`));
			}
			return sendedMessages;
		}
		else {
			return await message.say('❎ **Could not find the specified message.**');
		}
	}

}

export async function quoteEmbed(contextChannel: Discord.TextChannel | Discord.DMChannel, message: Discord.Message, user: Discord.User, footer = "Quoted") {
	const sendedMessages: Discord.Message[] = [];
	if (message.content) {
		sendedMessages.push(await contextChannel.send(buildQuoteEmbed(contextChannel, message, user, footer)));
	}
	if (message.embeds && message.embeds.length > 0 && message.author.bot) {
		for (let i = 0; i < message.embeds.length; i++) {
			const embed = message.embeds[i];
			sendedMessages.push(await contextChannel.send(`Raw embed#${i + 1} from \`${message.author.tag}\` in <#${message.channel.id}>`, embed));
		}
	}
	return sendedMessages;
}

export function buildQuoteEmbed(contextChannel: Discord.TextChannel | Discord.DMChannel, message: Discord.Message, user: Discord.User, footer: string): Discord.MessageEmbed {
	const embed = new Discord.MessageEmbed({
		description: message.content,
		timestamp: message.createdAt,
	});
	if (message.member && message.member.displayColor != 0) {
		embed.setColor(message.member.displayColor);
	}
	if (message.attachments && message.attachments.size > 0) {
		if (message.channel.type === 'text' && message.channel.nsfw && contextChannel.type === 'text' && !contextChannel.nsfw) {
			embed.addField("Attachments", ":underage: **Quoted message belongs in NSFW channel.**");
		}
		else if (message.attachments.size == 1 && String(message.attachments.array()[0].url).match(/(.jpg|.jpeg|.png|.gif|.gifv|.webp|.bmp)$/i)) {
			embed.setImage(message.attachments.array()[0].url);
		}
		else {
			message.attachments.forEach(attachment => {
				embed.addField("Attachment", `[${attachment.name}](${attachment.url})`, false);
			});
		}
	}
	embed.setAuthor(message.author.tag, message.author.displayAvatarURL(), message.url);
	if (message.channel.id != contextChannel.id && message.channel.type === 'text') {
		embed.setFooter(`${footer} by: ${user.tag} | in channel: #${message.channel.name}`);
	}
	else {
		embed.setFooter(`${footer} by: ${user.tag}`);
	}
	return embed;
}
