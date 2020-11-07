import config from 'config';
import { CronJob } from 'cron';
import { Client, FriendlyError } from "discord.js-commando";
import admin from "firebase-admin";
import moment from 'moment';
import path from "path";
import requireAll from "require-all";
import { FirestoreProvider } from "./firestore-provider";
import { initHttp } from "./http";
import { Logger } from "./logger";
import { getVisitor } from './ua';
import { isDevMode } from "./utils";

// init moment locale
moment.locale('zh-tw');

// process event handle
process
	.on('warning', Logger.warn)
	.on('unhandledRejection', (error) => {
		if (error instanceof Error && error['code'] && error['details'] && error['metadata']) {
			// grpc-js Error
			return;
		}
		Logger.error('Unhandled Promise Rejection:', error);
	})
	.on('uncaughtException', async (error) => {
		await Logger.error('Uncaught Exception:', error);
		process.exit(1);
	});

// init discord client
const client = new Client({
	owner: config.get("botOwners"),
	commandPrefix: config.get("prefix"),
	commandEditableDuration: 0,
	nonCommandEditable: false,
	partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
	presence: {
		status: 'dnd',
	},
});

// client event handle
client
	.on('error', Logger.error)
	.on('warn', Logger.warn)
	.on('debug', Logger.debug)
	.on('ready', async () => {
		Logger.log(`Ready! ${isDevMode() ? "DEBUG MODE" : ""}`);

		if (client.user) {
			client.user.setPresence({
				status: 'online',
				activity: {
					name: config.get("activity"),
					type: 'PLAYING',
				},
			});
		}
	})
	.on('disconnect', () => { Logger.warn('Disconnected!'); })
	.on('reconnecting', () => { Logger.warn('Reconnecting...'); })
	.on('commandError', (cmd, err, message, args, fromPattern) => {
		const fatal = !(err instanceof FriendlyError);
		getVisitor(message.author).exception(`CommandError: ${err}`, fatal).send();
		if (!fatal) return;
		Logger.error(`Error in command ${cmd.groupID}:${cmd.memberName}`, err);
	})
	.on('commandRun', (command, promise, message, args, fromPattern) => {
		getVisitor(message.author).event("command_run", {
			name: command.name,
			args,
		}).send();
	});

// init provider
const app = admin.initializeApp({
	credential: admin.credential.cert(config.get('firebaseAdmin.cert')),
	databaseURL: config.get('firebaseAdmin.databaseURL')
});
client.setProvider(new FirestoreProvider(app)).catch(Logger.error);

// init registry
client.registry
	.registerDefaultTypes()
	.registerDefaultGroups()
	.registerDefaultCommands({
		unknownCommand: false,
	})
	.registerGroups([
		['sdorica', 'Sdorica commands'],
		['fun', 'Fun commands'],
		['quote', 'Quote bot commands'],
		['config', 'Config commands'],
		['owner', 'Owner commands'],
	])
	.registerTypesIn({
		dirname: path.join(__dirname, 'types'),
		filter: /^([^\.].*)(?<!\.ignore)\.ts$/,
	})
	.registerCommandsIn({
		dirname: path.join(__dirname, 'commands'),
		filter: /^([^\.].*)(?<!\.ignore)\.ts$/,
	});

// set default command cooldown
client.registry.commands.forEach(command => {
	if (command.throttling === null) {
		command.throttling = {
			usages: 1,
			duration: config.get('defaultCooldown'),
		};
	}
});

// login to Discord
client.login(config.get("token"));

// init express server
initHttp(client);

// init cron
const jobs: Record<string, (client: Client) => CronJob> = requireAll({
	dirname: path.join(__dirname, 'crons'),
	filter: /^([^\.].*)(?<!\.ignore)\.cron\.ts$/,
	resolve: function (module) {
		return module.default;
	},
});

Object.values(jobs).forEach(job => {
	job(client).start();
});
