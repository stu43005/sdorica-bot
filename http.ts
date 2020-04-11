import * as Discord from 'discord.js';
import express, { NextFunction, Request, Response } from 'express';
import moment from "moment";
import { Logger } from "./logger";

function logErrors(err: any, req: Request, res: Response, next: NextFunction) {
	Logger.error('[Express error]', err);
	next(err);
}

function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
	res.status(500).json({ error: err.toString() });
}

export function initHttp(client: Discord.Client) {
	const app = express();
	app.set('view engine', 'ejs');
	app.use(express.urlencoded({
		extended: true,
	}));
	app.use(express.json());
	app.use(logErrors);
	app.use(errorHandler);

	app.get('/', (req, res) => {
		res.render('index', {
			readyAt: client.readyAt ? moment(client.readyAt).format('YYYY-MM-DD HH:mm:ss [UTC]ZZ') : '',
			uptime: client.uptime,
			ping: client.ws.ping,
			date: moment().format('YYYY-MM-DD HH:mm:ss [UTC]ZZ'),
		});
	});

	app.get('/channels/:guildId/:channelId/:messageId', async (req, res) => {
		try {
			const guild = client.guilds.resolve(req.params.guildId);
			if (guild) {
				const channel = guild.channels.resolve(req.params.channelId);
				if (channel && channel.type === 'text') {
					const textChannel = channel as Discord.TextChannel;
					let message = textChannel.messages.resolve(req.params.messageId);
					if (!message) {
						message = await textChannel.messages.fetch(req.params.messageId);
					}
					if (message) {
						const json = message.toJSON();
						json['author'] = message.author.toJSON();
						res.json(json);
						return;
					}
				}
			}
			res.status(404).json({ error: 'Not Found' });
		} catch (err) {
			res.status(500).json({ error: err.toString() });
		}
	});

	app.listen(process.env.PORT || 8080);
}
