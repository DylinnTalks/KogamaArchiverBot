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
				await this.dumpGame(gameData);
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