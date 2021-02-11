import * as Discord from 'discord.js';
import { ArgumentCollector, ArgumentInfo, CommandInfo, CommandoClient, CommandoMessage } from "discord.js-commando";
import { Logger } from './logger';
import { Command2 } from "./typings/discord.js-commando/command";

export interface FunctionArgument {
	argString: string;
	args: string[];
	argsResult: Record<string, any>;
}

export interface FunctionInfo {
	name: string;
	description: string;
	aliases?: string[];
	args?: ArgumentInfo[];
	argsCount?: number;
	argsSingleQuotes?: boolean;
	run: (message: Discord.Message, arg: FunctionArgument) => Promise<Discord.Message | Discord.Message[] | null> | null;
}

export interface SubCommandInfo {
	funcs: FunctionInfo[];
}

export class SubCommand extends Command2 {
	subinfo: SubCommandInfo;

	public constructor(client: CommandoClient, info: CommandInfo, subinfo: SubCommandInfo) {
		const funcNames = subinfo.funcs.map(func => func.name);
		const funcKeywordAll = subinfo.funcs.reduce((prev, curr) => {
			return curr.aliases ? prev.concat(curr.aliases) : prev;
		}, funcNames.slice(0));
		const helpString = subinfo.funcs.map(info => `- \`${info.name}\`: ${info.description}`).join("\n");

		info.args = [
			{
				type: 'string',
				key: 'func',
				prompt: `Please enter one of the following functions:\n${helpString}`,
				oneOf: funcKeywordAll,
			},
			{
				key: 'argString',
				type: 'string',
				prompt: 'function argument',
				default: '',
			},
		];
		if (!info.details) {
			info.details = `\nFunction list:\n${helpString}`;
		}
		super(client, info);
		this.subinfo = subinfo;
	}

	async run2(message: Discord.Message, { func, argString }: { func: string, argString: string }) {
		const funcInfo = this.subinfo.funcs.find(f => f.name === func || f.aliases?.includes(func));
		if (!funcInfo) return null;

		const argsSingleQuotes = 'argsSingleQuotes' in funcInfo ? funcInfo.argsSingleQuotes : true;
		const funcArgs: FunctionArgument = {
			argString: argString.replace(argsSingleQuotes ? /^("|')([^]*)\1$/g : /^(")([^]*)"$/g, '$2'),
			args: CommandoMessage.parseArgs(argString, funcInfo.argsCount || 0, argsSingleQuotes),
			argsResult: {},
		};

		if (funcInfo.args && funcInfo.args.length) {
			const count = funcInfo.args[funcInfo.args.length - 1].infinite ? Infinity : funcInfo.args.length;
			const provided = CommandoMessage.parseArgs(argString, count, argsSingleQuotes);

			const collector = new ArgumentCollector(this.client, funcInfo.args);
			const collResult = await collector.obtain(message, provided);
			if (collResult.cancelled || !collResult.values) {
				this.client.emit('commandCancel', this, collResult.cancelled || 'noValues', message as CommandoMessage);
				return message.reply('Cancelled command.');
			}
			funcArgs.argsResult = collResult.values;
		}

		Logger.debug(`Running sub-command ${this.groupID}:${this.memberName}:${funcInfo.name}`);
		const retVal = await funcInfo.run(message, funcArgs);
		return retVal;
	}

}
