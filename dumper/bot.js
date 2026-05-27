const Discord = require("../discord/discord");
const { WebSocketManager } = require("../utils/WebSocketManager.js");

class Bot {
	gameData;
	sessionLocatorData;
	socket;

	async dumpGame(gameData) {
		this.gameData = gameData;
		this.sessionLocatorData = await this.getSessionLocator();

		let planetData = await this.connectToGameServer();

		await this.sendToDiscord(planetData);
	}

	async getSessionLocator() {
		let domain = this.gameData.domain || "www.kogama.com";
		let sessionLocatorResponse = await fetch(`https://${domain}/locator/session/?objectID=${this.gameData.id}&profileID=0&lang=en_US&type=play&referrer=kogama`);
		
		if (!sessionLocatorResponse.ok) {
			throw new Error(`Failed to get session locator for game ${this.gameData.id}`);
		}

		let sessionLocatorData = await sessionLocatorResponse.json();

		return sessionLocatorData;
	}

	async connectToGameServer() {
		this.sessionLocatorData.objectID = this.gameData.id;

		let webSocketManager = new WebSocketManager(this.sessionLocatorData,)

		webSocketManager.Connect();

		return new Promise((resolve, reject) => {
			webSocketManager.onDisconnected = (code, reason) => {
				reject(new Error(`WebSocket disconnected: Code=${code}, Reason=${reason}`));
			};

			webSocketManager.onConnected = () => {
				let planetData = Buffer.from(webSocketManager.EventManager.GameSnapShotInstances.InitWorld);
				resolve(planetData);
			}
		});
	}

	async sendToDiscord(planetData) {
		await Discord.sendToDiscord(this.gameData, planetData);
	}
}

module.exports = Bot;