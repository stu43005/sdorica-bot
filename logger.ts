import { codeBlock, inlineCode } from '@discordjs/builders';
import config from "config";
import { ColorResolvable, DiscordAPIError, MessageEmbed, WebhookClient } from "discord.js";
import { isDevMode, jsonBlock } from "./utils";

let webhookClient: WebhookClient | null = null;
if (config.has('logWebhook.id') && config.has('logWebhook.token')) {
	webhookClient = new WebhookClient(config.get('logWebhook.id'), config.get('logWebhook.token'));
}

export class Logger {

	public static get info() { return Logger.log; }
	public static async log(...msgs: any[]) {
		console.log('ℹ️', ...msgs);
		if (webhookClient) await webhookClient.send(buildEmbed(0xd5d5d5, 'ℹ️', msgs)).catch(webhookError);
	}

	public static async debug(...msgs: any[]) {
		if (isDevMode()) {
			console.debug('🐛', ...msgs);
		}
	}

	public static async warn(...msgs: any[]) {
		console.warn('⚠️', ...msgs);
		if (webhookClient) await webhookClient.send(buildEmbed(0xfedda1, '⚠️', msgs)).catch(webhookError);
	}

	public static async error(...msgs: any[]) {
		console.error('❌', ...msgs);
		if (webhookClient) await webhookClient.send(buildEmbed(0xfe8082, '❌', msgs)).catch(webhookError);
	}
}

function webhookError(reason: any) {
	console.error('❌', '[Logger] Webhoook error:', reason);
	if (reason instanceof DiscordAPIError && reason.code !== 400) {
		webhookClient = null;
	}
}

function buildEmbed(color: ColorResolvable, emoji: string, msgs: any[]) {
	const embed = new MessageEmbed();
	embed.setColor(color);
	embed.setDescription(emoji + '：' + buildMessage(msgs));
	return embed;
}

function buildMessage(msgs: any[]) {
	return msgs.map(msg => {
		if (msg === null) {
			return inlineCode(`null`);
		}
		if (typeof msg === 'undefined') {
			return inlineCode(`undefined`);
		}
		if (typeof msg === 'symbol') {
			return inlineCode(`Symbol()`);
		}
		if (typeof msg === 'object') {
			if (msg instanceof Error) {
				return codeBlock(msg.stack ?? msg.toString());
			}
			return jsonBlock(msg);
		}
		return msg;
	}).join(' ');
}
