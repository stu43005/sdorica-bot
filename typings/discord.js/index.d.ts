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
		command: Command;

		/**
		 * Argument string for the command
		 * @type {?string}
		 */
		argString: string;

		/**
		 * Pattern matches (if from a pattern trigger)
		 * @type {?string[]}
		 */
		patternMatches: string[];

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
		anyUsage(command?: string, prefix?: string, user?: User): string;

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
		run(): Promise<Message | Message[]>;

		/**
		 * Responds with a plain message
		 * @param {StringResolvable} content - Content for the message
		 * @param {MessageOptions} [options] - Options for the message
		 * @return {Promise<Message|Message[]>}
		 */
		say(content: StringResolvable, options?: MessageOptions | MessageAdditions): Promise<Message | Message[]>;

		/**
		 * Responds with a reply message
		 * @param {StringResolvable} content - Content for the message
		 * @param {MessageOptions} [options] - Options for the message
		 * @return {Promise<Message|Message[]>}
		 */
		reply(content: StringResolvable, options?: MessageOptions | MessageAdditions): Promise<Message | Message[]>;

		/**
		 * Responds with a direct message
		 * @param {StringResolvable} content - Content for the message
		 * @param {MessageOptions} [options] - Options for the message
		 * @return {Promise<Message|Message[]>}
		 */
		direct(content: StringResolvable, options?: MessageOptions | MessageAdditions): Promise<Message | Message[]>;

		/**
		 * Responds with a code message
		 * @param {string} lang - Language for the code block
		 * @param {StringResolvable} content - Content for the message
		 * @param {MessageOptions} [options] - Options for the message
		 * @return {Promise<Message|Message[]>}
		 */
		code(lang: string, content: StringResolvable, options?: MessageOptions | MessageAdditions): Promise<Message | Message[]>;

		/**
		 * Responds with an embed
		 * @param {RichEmbed|Object} embed - Embed to send
		 * @param {StringResolvable} [content] - Content for the message
		 * @param {MessageOptions} [options] - Options for the message
		 * @return {Promise<Message|Message[]>}
		 */
		embed(embed: MessageEmbed | {}, content?: StringResolvable, options?: MessageOptions | MessageAdditions): Promise<Message | Message[]>;

		/**
		 * Responds with a mention + embed
		 * @param {RichEmbed|Object} embed - Embed to send
		 * @param {StringResolvable} [content] - Content for the message
		 * @param {MessageOptions} [options] - Options for the message
		 * @return {Promise<Message|Message[]>}
		 */
		replyEmbed(embed: MessageEmbed | {}, content?: StringResolvable, options?: MessageOptions | MessageAdditions): Promise<Message | Message[]>;
	}

	// static
	namespace Message {
		/**
		 * Parses an argument string into an array of arguments
		 * @param {string} argString - The argument string to parse
		 * @param {number} [argCount] - The number of arguments to extract from the string
		 * @param {boolean} [allowSingleQuote=true] - Whether or not single quotes should be allowed to wrap arguments,
		 * in addition to double quotes
		 * @return {string[]} The array of arguments
		 */
		function parseArgs(argString: string, argCount?: number, allowSingleQuote?: boolean): string[];
	}

	interface Guild {
		/**
		 * Shortcut to use setting provider methods for this guild
		 * @type {GuildSettingsHelper}
		 */
		settings: GuildSettingsHelper;

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
		isCommandEndabled(command: CommandResolvable): boolean;

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
		commandBlock: [Message, string, Object | undefined];
		commandCancel: [Command, string, Message];
		commandError: [Command, Error, Message, object | string | string[], boolean];
		commandPrefixChange: [Guild, string];
		commandRegister: [Command, CommandoRegistry];
		commandReregister: [Command, Command];
		commandRun: [Command, Promise<any>, Message, object | string | string[], boolean];
		commandStatusChange: [Guild, Command, boolean];
		commandUnregister: [Command];
		groupRegister: [CommandGroup, CommandoRegistry];
		groupStatusChange: [Guild, CommandGroup, boolean];
		providerReady: [SettingProvider];
		typeRegister: [ArgumentType, CommandoRegistry];
		unknownCommand: [Message];
	}
}
