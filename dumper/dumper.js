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