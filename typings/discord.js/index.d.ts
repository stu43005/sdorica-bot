import { ArgumentType, Command, CommandGroup, CommandoRegistry, GuildSettingsHelper, SettingProvider } from 'discord.js-commando';
type CommandResolvable = Command | string;
type CommandGroupResolvable = CommandGroup | string;

declare module 'discord.js' {

	/**
	 * @see discord.js: {@link https://discord.js.org/#/docs/main/master/class/Message|Message}
	 * @see discord.js-commando: {@link https://discord.js.org/#/docs/commando/master/class/CommandoMessage|CommandoMessage}
	 */
	interface Message {
		/**
		 * Whether the message contains a command (even an unknown one)
		 * @type {boolean}
		 */
		isCommand: boolean;

		/**
		 * Command that the message triggers, if any
		 * @type {?Command}
		 */
		command: Command | null;

		/**
		 * Argument string for the command
		 * @type {?string}
		 */
		argString: string | null;

		/**
		 * Pattern matches (if from a pattern trigger)
		 * @type {?string[]}
		 */
		patternMatches: string[] | null;

		/**
		 * Creates a usage string for the message's command
		 * @param {string} [argString] - A string of arguments for the command
		 * @param {string} [prefix=this.guild.commandPrefix || this.client.commandPrefix] - Prefix to use for the prefixed command format
		 * @param {User} [user=this.client.user] - User to use for the mention command format
		 * @return {string}
		 */
		usage(argString?: string, prefix?: string, user?: User): string;

		/**
		 * Creates a usage string for any command
		 * @param {string} [command] - A command + arg string
		 * @param {string} [prefix=this.guild.commandPrefix || this.client.commandPrefix] - Prefix to use for the prefixed command format
		 * @param {User} [user=this.client.user] - User to use for the mention command format
		 * @return {string}
		 */
		anyUsage(argString?: string, prefix?: string, user?: User): string;

		/**
		 * Parses the argString into usable arguments, based on the argsType and argsCount of the command
		 * @return {string|string[]}
		 * @see {@link Command#run}
		 */
		parseArgs(): string | string[];

		/**
		 * Runs the command
		 * @return {Promise<?Message|?Array<Message>>}
		 */
		run(): Promise<null | Message | Message[]>;

		/**
		 * Responds with a plain message
		 * @param {StringResolvable} content - Content for the message
		 * @param {MessageOptions} [options] - Options for the message
		 * @return {Promise<Message|Message[]>}
		 */
		say(
			content: StringResolvable | (MessageOptions & { split?: false }) | MessageAdditions,
			options?: (MessageOptions & { split?: false }) | MessageAdditions
		): Promise<Message>;
		say(
			content: StringResolvable | (MessageOptions & { split: true | Exclude<MessageOptions['split'], boolean> }) | MessageAdditions,
			options?: (MessageOptions & { split: true | Exclude<MessageOptions['split'], boolean> }) | MessageAdditions
		): Promise<Message[]>;

		/**
		 * Responds with a direct message
		 * @param {StringResolvable} content - Content for the message
		 * @param {MessageOptions} [options] - Options for the message
		 * @return {Promise<Message|Message[]>}
		 */
		direct: Message['say'];

		/**
		 * Responds with a code message
		 * @param {string} lang - Language for the code block
		 * @param {StringResolvable} content - Content for the message
		 * @param {MessageOptions} [options] - Options for the message
		 * @return {Promise<Message|Message[]>}
		 */
		code: Message['say'];

		/**
		 * Responds with an embed
		 * @param {RichEmbed|Object} embed - Embed to send
		 * @param {StringResolvable} [content] - Content for the message
		 * @param {MessageOptions} [options] - Options for the message
		 * @return {Promise<Message|Message[]>}
		 */
		embed(embed: MessageEmbed, content?: StringResolvable, options?: (MessageOptions & { split?: false }) | MessageAdditions): Promise<Message>;
		embed(embed: MessageEmbed, content?: StringResolvable, options?: (MessageOptions & { split: true | Exclude<MessageOptions['split'], boolean> }) | MessageAdditions): Promise<Message[]>;

		/**
		 * Responds with a mention + embed
		 * @param {RichEmbed|Object} embed - Embed to send
		 * @param {StringResolvable} [content] - Content for the message
		 * @param {MessageOptions} [options] - Options for the message
		 * @return {Promise<Message|Message[]>}
		 */
		replyEmbed: Message['embed'];
	}

	interface Guild {
		/**
		 * Shortcut to use setting provider methods for this guild
		 * @type {GuildSettingsHelper}
		 */
		readonly settings: GuildSettingsHelper;

		/**
		 * Command prefix in the guild. An empty string indicates that there is no prefix, and only mentions will be used.
		 * Setting to `null` means that the prefix from {@link CommandoClient#commandPrefix} will be used instead.
		 * @type {string}
		 * @emits {@link CommandoClient#commandPrefixChange}
		 */
		commandPrefix: string;

		/**
		 * Sets whether a command is enabled in the guild
		 * @param {CommandResolvable} command - Command to set status of
		 * @param {boolean} enabled - Whether the command should be enabled
		 */
		setCommandEnabled(command: CommandResolvable, enabled: boolean): void;

		/**
		 * Checks whether a command is enabled in the guild (does not take the command's group status into account)
		 * @param {CommandResolvable} command - Command to check status of
		 * @return {boolean}
		 */
		isCommandEnabled(command: CommandResolvable): boolean;

		/**
		 * Sets whether a command group is enabled in the guild
		 * @param {CommandGroupResolvable} group - Group to set status of
		 * @param {boolean} enabled - Whether the group should be enabled
		 */
		setGroupEnabled(group: CommandGroupResolvable, enabled: boolean): void;

		/**
		 * Checks whether a command group is enabled in the guild
		 * @param {CommandGroupResolvable} group - Group to check status of
		 * @return {boolean}
		 */
		isGroupEnabled(group: CommandGroupResolvable): boolean;

		/**
		 * Creates a command usage string using the guild's prefix
		 * @param {string} [command] - A command + arg string
		 * @param {User} [user=this.client.user] - User to use for the mention command format
		 * @return {string}
		 */
		commandUsage(command?: string, user?: User): string;
	}

	interface ClientEvents {
		commandBlock:
		| [Message, string, object?]
		| [Message, 'guildOnly' | 'nsfw']
		| [Message, 'permission', { response?: string }]
		| [Message, 'throttling', { throttle: object, remaining: number }]
		| [Message, 'clientPermissions', { missing: string }];
		commandCancel: [Command, string, Message];
		commandError:
		| [Command, Error, Message, object | string | string[], false]
		| [Command, Error, Message, string[], true];
		commandPrefixChange: [Guild, string];
		commandRegister: [Command, CommandoRegistry];
		commandReregister: [Command, Command];
		commandRun: [Command, Promise<any>, Message, object | string | string[], boolean];
		commandStatusChange: [Guild, Command, boolean];
		commandUnregister: [Command];
		groupRegister: [CommandGroup, CommandoRegistry];
		groupStatusChange: [Guild, CommandGroup, boolean];
		typeRegister: [ArgumentType, CommandoRegistry];
		unknownCommand: [Message];
		providerReady: [SettingProvider];
	}
}
