import * as Discord from "discord.js";
import { CommandoClient } from "discord.js-commando";
import { Command2 } from "../../typings/discord.js-commando/command";
import { getOnce } from "../../utils";

const mee6Roles = [
	"600722580554645512",
	"563071305860251658",
	"528452576786776084",
	"510500081242341376",
	"491245761703444480",
	"480380943400435728",
	"468212645074436097",
	"472745958866944000",
	"467673070392573962",
	"458648914250170373",
	"458648552197849088",
	"458645463810441228",
	"458476983412588577",
	"457518374688129044",
	"458792329784983572",
];
const assignRole = "622371686502891529";

export default class CheckMemberCommand extends Command2 {
	constructor(client: CommandoClient) {
		super(client, {
			name: 'check-member',
			group: 'owner',
			memberName: 'check-member',
			description: '檢查伺服器所有成員的用戶組',
			guildOnly: true,
			ownerOnly: true,
		});

		client.on('guildMemberUpdate', (oldMember: Discord.GuildMember | Discord.PartialGuildMember, newMember: Discord.GuildMember) => {
			if (newMember.guild.id === '437330083976445953') {
				checkMember(newMember);
			}
		});
	}

	async run2(message: Discord.Message) {
		if (!message.guild) return null;

		if (message.guild.id !== '437330083976445953') { return null; }
		const guild = message.guild;
		const sendedMessage = await message.say("Okay. pleace wait...");
		await Array.from(guild.members.cache.values()).reduce<Promise<void>>(async (prev, member) => {
			await prev;
			await checkMember(member);
		}, Promise.resolve());
		await getOnce(sendedMessage).edit("Okay. done!");
		return sendedMessage;
	}

}

async function checkMember(member: Discord.GuildMember) {
	const matchedRoles = Array.from(member.roles.cache.keys()).filter(r => mee6Roles.includes(r));
	if (matchedRoles.length > 0 && !member.roles.cache.has(assignRole)) {
		await member.roles.add(assignRole);
	}
}
