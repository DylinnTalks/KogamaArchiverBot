const GameQueue = require('./gameQueue');
const Bot = require('./bot');

class Dumper {
	threads;

	static async init() {
		this.threads = [];
	}

	static async start() {
		while (true) {
			let gameData = GameQueue.get();

			if (gameData) {
				try {
					await this.dumpGame(gameData);
				} catch (error) {
					console.error("Failed to dump game:", error);

					let retries = gameData.retries || 0;
					if (retries < 3) {
						console.log(`Retrying game ${gameData.id} in 30 seconds (attempt ${retries + 1}/3)`);
						gameData.retries = retries + 1;
						GameQueue.add(gameData);
						await new Promise(resolve => setTimeout(resolve, 30000));
					} else {
						console.error(`Game ${gameData.id} failed after 3 retries, skipping.`);
					}
				}
				await new Promise(resolve => setTimeout(resolve, 100));
			} else {
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		}
	}

	static async dumpGame(gameData) {
		let bot = new Bot();

		await bot.dumpGame(gameData);
	}
}

module.exports = Dumper;