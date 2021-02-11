import { GuildChannel, Util } from "discord.js";
import { Argument, ArgumentType, CommandoClient, CommandoMessage, util } from "discord.js-commando";

export default class NewsChannelArgumentType extends ArgumentType {
	constructor(client: CommandoClient) {
		super(client, 'news-channel');
	}

	validate(val: string, msg: CommandoMessage, arg: Argument) {
		const matches = val.match(/^(?:<#)?([0-9]+)>?$/);
		if (matches) {
			try {
				const channel = msg.client.channels.resolve(matches[1]);
				if (!channel || channel.type !== 'news') return false;
				if (arg.oneOf && !arg.oneOf.includes(channel.id)) return false;
				return true;
			} catch (err) {
				return false;
			}
		}
		if (!msg.guild) return false;
		const search = val.toLowerCase();
		let channels = msg.guild.channels.cache.filter(channelFilterInexact(search));
		if (channels.size === 0) return false;
		if (channels.size === 1) {
			if (arg.oneOf && !arg.oneOf.includes(channels.first()?.id!)) return false;
			return true;
		}
		const exactChannels = channels.filter(channelFilterExact(search));
		if (exactChannels.size === 1) {
			if (arg.oneOf && !arg.oneOf.includes(exactChannels.first()?.id!)) return false;
			return true;
		}
		if (exactChannels.size > 0) channels = exactChannels;
		return channels.size <= 15 ?
			`${util.disambiguation(
				channels.map(chan => Util.escapeMarkdown(chan.name)), 'news channels'
			)}\n` :
			'Multiple news channels found. Please be more specific.';
	}

	parse(val: string, msg: CommandoMessage) {
		const matches = val.match(/^(?:<#)?([0-9]+)>?$/);
		if (matches) return msg.client.channels.resolve(matches[1]) || null;
		if (!msg.guild) return null;
		const search = val.toLowerCase();
		const channels = msg.guild.channels.cache.filter(channelFilterInexact(search));
		if (channels.size === 0) return null;
		if (channels.size === 1) return channels.first();
		const exactChannels = channels.filter(channelFilterExact(search));
		if (exactChannels.size === 1) return exactChannels.first();
		return null;
	}
}

function channelFilterExact(search: string) {
	return (chan: GuildChannel) => chan.type === 'news' && chan.name.toLowerCase() === search;
}

function channelFilterInexact(search: string) {
	return (chan: GuildChannel) => chan.type === 'news' && chan.name.toLowerCase().includes(search);
}
