const fs = require('fs');
const DiscordJS = require('discord.js');

class Discord {
	/** @type {DiscordJS.Client} */
	static client;

	/** @type {DiscordJS.REST} */
	static rest;

	static async init() {
		this.client = new DiscordJS.Client({
			intents: [
				DiscordJS.GatewayIntentBits.Guilds,
				DiscordJS.GatewayIntentBits.GuildMessages,
				DiscordJS.GatewayIntentBits.MessageContent,
			],
		});

		this.rest = new DiscordJS.REST().setToken(process.env.DISCORD_CLIENT_TOKEN);
	}

	static async start() {
		await this.client.login(process.env.DISCORD_CLIENT_TOKEN);
		await this.registerCommands();

		this.handleCommands();
	}

	static async registerCommands() {
		let commands = [];

		for (let file of fs.readdirSync('./discord/commands').filter(file => file.endsWith('.js'))) {
			let command = require(`./commands/${file}`);
			
			if ('data' in command && 'execute' in command) {
				commands.push(command.data.toJSON());
			} else {
				console.warn(`Command ${file} is missing "data" or "execute" property.`);
			}
		}

		await this.rest.put(DiscordJS.Routes.applicationCommands(this.client.user.id), { body: commands });
	}

	static async handleCommands() {
		this.client.on('interactionCreate', async interaction => {
			if (!interaction.isChatInputCommand()) return;

			const command = require(`./commands/${interaction.commandName}.js`);

			if (!command) {
				console.error(`No command found for ${interaction.commandName}`);
				return;
			}

			try {
				await command.execute(interaction);
			} catch (error) {
				console.error(`Error executing command ${interaction.commandName}:`, error);

				try {
					if (interaction.replied || interaction.deferred) {
						await interaction.followUp({ content: '❌ | There was an error while executing this command!', flags: DiscordJS.MessageFlags.Ephemeral });
					} else {
						await interaction.reply({ content: '❌ | There was an error while executing this command!', flags: DiscordJS.MessageFlags.Ephemeral });
					}
				} catch {}
			}
		});
	}

	static async sendToDiscord(gameData, planetData) {
		let channel = await this.client.channels.fetch(process.env.DISCORD_CHANNEL_ID);

		let attachment = new DiscordJS.AttachmentBuilder(planetData, { name: `${gameData.id}.kgm` });

		await channel.send({ content: `🆕 | \`${gameData.name}\` (ID: \`${gameData.id}\`) created by \`${gameData.owner}\``, files: [attachment] });
	}
}

module.exports = Discord;