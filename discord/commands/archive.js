const DiscordJS = require('discord.js');
const GameQueue = require('../../dumper/gameQueue');

class Command {
	static data = new DiscordJS.SlashCommandBuilder()
		.setName('archive')
		.setDescription('Archives a KoGaMa game')
		.addStringOption(option => {
			option
				.setName('url')
				.setDescription('The URL of the KoGaMa game to archive')
				.setRequired(true);
			
			return option;
		});
	
	/** @param {DiscordJS.Interaction} interaction  */
	static async execute(interaction) {
		await interaction.deferReply({ flags: DiscordJS.MessageFlags.Ephemeral });

		let url = interaction.options.getString('url');

		let isKogamaUrl = false;
		let gameId;
		let domain;

		try {
			let parsedUrl = new URL(url);

			if (['www.kogama.com', 'kogama.com', 'friends.kogama.com', 'kogama.com.br'].includes(parsedUrl.hostname)) {
				let pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);

				if (pathParts.length >= 3 && pathParts[0] === 'games' && pathParts[1] === 'play') {
					if (Number.isInteger(parseInt(pathParts[2]))) {
						isKogamaUrl = true;
						gameId = parseInt(pathParts[2]);
						domain = parsedUrl.hostname;
					}
				}
			}
		} catch (error) {
			isKogamaUrl = false;
		}

		if (!isKogamaUrl) {
			return await interaction.editReply({ content: '❌ | Please provide a valid KoGaMa game URL.' });
		}

		let isValidGame = false;
		let gameData;

		try {
			let gameMembersResponse = await fetch(`https://${domain}/game/${gameId}/member/?count=1`);

			if (gameMembersResponse.ok) {
				gameData = (await gameMembersResponse.json()).data[0];

				if (gameData && gameData.game_id === gameId) {
					isValidGame = true;
				}
			}
		} catch (error) {
			isValidGame = false;
		}

		if (!isValidGame) {
			return await interaction.editReply({ content: '❌ | The provided URL does not correspond to a valid KoGaMa game.' });
		}

		await interaction.editReply({ content: `✅ | Added \`${gameData.name}\` (ID: \`${gameId}\`) by \`${gameData.member_username}\` to the queue!` });

		GameQueue.add({
			id: gameId,
			name: gameData.name,
			owner: gameData.member_username,
			requestedBy: interaction.user.id,
			domain: domain,
		})
	}
}

module.exports = Command;