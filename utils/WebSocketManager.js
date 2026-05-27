const { parseSocket, toSocket, Int, String, Byte, ByteArray, TArray, Dictionary, Float, Double, Short, Long, Bool, getPackerInfo } = require("./BytePacker.js")
const WebSocket = require('ws');
const { MVEventCodes, MVOperationCodes, XPRewardType, MVGameStateType, MVParameterKeys } = require("../constants/MVCommon.json");
const OperationRequests = require("./OperationRequest.js");
const { SecurityHelper } = require("./KeyGenerator.js");
const os = require("os");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));


let find = (object, value) => {
    let result = undefined;
    try {
        result = Object.entries(object).filter(val => val[1] == value)[0][0];
    } catch { }
    return result;
}
let try_ = (f, er = _ => 0) => {
    try {
        return f();
    } catch (e) {
        return er(e);
    }
}
class GameWorldManager {
    static WorldInstances = [];
    constructor() {
        this.instance = GameWorldManager.WorldInstances.push({ player: {}, players: {}, world: {}, FlagDebriefingControl: {} }) - 1
    }
    static get(instance) {
        return GameWorldManager.WorldInstances[instance];
    }
}

class OperationResponseManager {
    constructor({ ws, instance }) {
        this.ws = ws;
        this.GameWorldManager = GameWorldManager.get(instance);
    }
    SendWS(obj) {
        this.ws.send(toSocket(obj));
    }
    GetTimeStamp() {
        return this.TimeStamp + Date.now() - this.TimeStampDate;
    }
    async UnregisterWorldObject(socket) {
        this.TimeStamp = socket[2].value;
        this.TimeStampDate = Date.now();
        if (socket.header[1] == 7) this.SendWS(OperationRequests.GamePing(os.uptime() * 1e3));
    }
    Join(socket) {
        if (socket.size == 0) {
            this.ws.close();
            return;
        }
        this.SendWS(OperationRequests.Syncronize());
        this.GameWorldManager.player = {
            ActorNr: socket[MVParameterKeys.ActorNr].value,
            UserProfileData: JSON.parse(socket[MVParameterKeys.UserProfileData].value)
        };
        //console.log(this.GameWorldManager.player);
    }
}
class EventManager {
    TeleportTarget = null;
    GameSnapShotInstances = {};
    HandleAccessories(socket) {
        try_(_ => {
            const QueryId = socket[MVParameterKeys.QueryId].value
            if (!this.GameSnapShotInstances[QueryId]) this.GameSnapShotInstances[QueryId] = [];
            this.GameSnapShotInstances[QueryId].push(...socket[MVParameterKeys.Data].value)
            if (!socket[MVParameterKeys.QueryId].value) {
                this.GameWorldManager.AccessoriesData = JSON.parse(new TextDecoder('utf-8').decode(new Uint8Array(this.GameSnapShotInstances[QueryId])));
                delete this.GameSnapShotInstances[QueryId];
            }
        })
    }
    HandleNewWorldObjects(socket) {
        //99 QueryId
        //100 QueryLeft

        const QueryId = socket[MVParameterKeys.QueryId].value
        if (!this.GameSnapShotInstances[QueryId]) this.GameSnapShotInstances[QueryId] = [];
        this.GameSnapShotInstances[QueryId].push(...socket[MVParameterKeys.Data].value)
        if (!socket[MVParameterKeys.QueryDataLeft].value) {
            let { Prototypes, WorldObjects, ObjectLinks, Links } = getPackerInfo(this.GameSnapShotInstances[QueryId]);
            this.GameWorldManager.world.Prototypes.push(...Prototypes);
            this.GameWorldManager.world.WorldObjects.push(...WorldObjects);
            this.GameWorldManager.world.ObjectLinks.push(...ObjectLinks);
            this.GameWorldManager.world.Links.push(...Links);
            delete this.GameSnapShotInstances[QueryId];
        }
    }
    constructor({ ws, isXPInstance, locateData, instance, onConnected, OperationResponseManager }) {
        this.ws = ws;
        this.isXPInstance = isXPInstance;
        this.locateData = locateData;
        this.instance = instance;
        this.GameWorldManager = GameWorldManager.get(instance);
        this.onConnected = onConnected;
        this.OperationResponseManager = OperationResponseManager;
    }
    SendWS(obj) {
        this.ws.send(toSocket(obj));
    }
    HighScores(socket) {
        //try_(() => console.log("[HighScores]", JSON.parse(socket[MVParameterKeys.Data].value)));
    }
    UpdateWorldObjectRunTimeData(socket) {
        if (this.TeleportTarget == socket[MVParameterKeys.ActorNr].value) {
            this.SendWS(OperationRequests.UpdateWorldObjectRunTimeData(this.GameWorldManager.player.Data.activeSpawnRole, socket[MVParameterKeys.WorldObjectRunTimeData].value));
        }
    }
    UpdateLineOfFire(socket) {
        if (this.TeleportTarget == socket[MVParameterKeys.ActorNr].value) {
            this.SendWS(OperationRequests.UpdateLineOfFire(
                this.GameWorldManager.player.Data.activeSpawnRole,
                socket[MVParameterKeys.CamOriginX].value,
                socket[MVParameterKeys.CamOriginY].value,
                socket[MVParameterKeys.CamOriginZ].value,
                socket[MVParameterKeys.CamDirX].value,
                socket[MVParameterKeys.CamDirY].value,
                socket[MVParameterKeys.CamDirZ].value,
            ));
        }
    }
    UpdateWorldObject(socket) {
        if (this.TeleportTarget == socket[MVParameterKeys.ActorNr].value || this.TeleportTarget == 69690) {
            const rot = socket[MVParameterKeys.ByteRotation].value;
            this.SendWS(OperationRequests.UpdateWorldObject(
                this.GameWorldManager.player.Data.activeSpawnRole,
                socket[MVParameterKeys.PosX].value, socket[MVParameterKeys.PosY].value, socket[MVParameterKeys.PosZ].value + 2 + this.instance * 2,
                this.OperationResponseManager.GetTimeStamp(),
                "Interpolate",
                [rot[0], rot[1], rot[2]]
            ));
        }
    }
    GameStateChange(socket) {
        //console.log(`[${this.instance},GameStateChange]:`);
        /*
        const packet = {
            GameStateType: find(MVGameStateType, socket[65].value),
            StartTime: socket[67].value,
            Duration: socket[66].value,
        }

        console.log(JSON.stringify(packet));

        if (this.isXPInstance) {
            this.SendWS(OperationRequests.IncrementStatRequest(7));
            const spawn = this.GameWorldManager.world.WorldObjects.find(l => l.WorldObjectType.includes("SpawnPoint"));
            for (let i = 0; i < 3; i++) {
                this.SendWS(OperationRequests.UpdateWorldObject(
                    this.GameWorldManager.player.Data.activeSpawnRole,
                    spawn.Position.X, spawn.Position.Y, spawn.Position.Z,
                    this.OperationResponseManager.GetTimeStamp(),
                    "Interpolate",
                    [0, 0, 0]
                ));
            }
        }
            */
    }
    UpdateGameStat(socket) {
        //console.log(`[${this.instance}]: UpdateGameStat`);
    }
    OnXPReward() { }
    async XPReward(socket) {

        const CurrentPlayerXP = socket[MVParameterKeys.CurrentPlayerXP].value;
        const AmountXP = socket[MVParameterKeys.AmountXP].value;
        const XPRewardType_ = find(XPRewardType, socket[MVParameterKeys.XPRewardType].value);

        this.OnXPReward(CurrentPlayerXP, AmountXP, XPRewardType_);
        //console.log(`[${this.instance}]: CurrentPlayerXP: ${CurrentPlayerXP}, AmountXP: ${AmountXP}, XPRewardType: ${XPRewardType_}, `)
    }
    NoCodeSet() {
        this.SendWS(OperationRequests.GamePing(os.uptime() * 1e3));
        this.SendWS(OperationRequests.Handshake());
    }
    Handshake(socket) {
        const { objectID, sessionToken, lang, token, sessionID } = this.locateData;
        this.SendWS(OperationRequests.Join(
            SecurityHelper.encrypt(socket[MVParameterKeys.Data].value),
            sessionToken,
            objectID,
            1,//gameMode
            "en_US",
            token,
            sessionID,
            2,//webgl
            5, 3
        ))
    }
    async SetActorReady(socket) {
        if (socket[MVParameterKeys.ActorNr].value == this.GameWorldManager.player.ActorNr) {
            //this.SendWS(OperationRequests.GetAllPlanetPermissions(0));
            //this.SendWS(OperationRequests.GetPlanetOwnerships(0));
            this.SendWS(OperationRequests.IncrementStatRequest(4));
            this.SendWS(OperationRequests.StartSessionTime());
            this.SendWS(OperationRequests.UpdateWorldObjectRunTimeData(this.GameWorldManager.player.Data.activeSpawnRole, [
                {
                    key: new String('animation'), value: new Dictionary([
                        { key: new String('state'), value: new String('Idle') },
                        { key: new String('timeStamp'), value: new Int(this.OperationResponseManager.GetTimeStamp()) },
                    ], 0, 0)
                },
                {
                    key: new String('currentItem'), value: new Dictionary([
                        { key: new String('type'), value: new Int(5) },
                        { key: new String('variantId'), value: new Int(0) },
                        { key: new String('updateItemState'), value: new Int(4) }
                    ], 0, 0)
                }
            ]));
            this.SendWS(OperationRequests.UpdateWorldObject(
                this.GameWorldManager.player.Data.activeSpawnRole,
                ...[0, 0, 0],
                this.OperationResponseManager.GetTimeStamp(),
                "Interpolate",
                [192, 30, 200]
            ));
            this.SendWS(OperationRequests.RequestAccessoryData());
            this.SendWS(OperationRequests.LevelChanged(46));
            //console.log(`${this.instance} Done.`)


            setTimeout(l => {
                this.SendWS(OperationRequests.IncrementStatRequest(7));
                this.SendWS(OperationRequests.UpdateWorldObjectRunTimeData(this.GameWorldManager.player.Data.activeSpawnRole, [
                    {
                        key: new String('spawnRoleModeType'),
                        value: new Int(1)
                    }
                ]));

            }, 1e3)
            this.onConnected();
        }
    }
    SetupUserPlayMode(socket) {
        //207 -> MetaData
        //245 -> Data

        //const GameStateType = socket[65].value,
        //    GameStateDuration = socket[66].value,
        //    GameStateStartTime = socket[67].value;

        this.GameWorldManager.player = Object.assign(this.GameWorldManager.player, {
            Data: JSON.parse(socket[MVParameterKeys.Data].value),
            MetaData: JSON.parse(socket[MVParameterKeys.MetaData].value)
        });
    }
    GameSnapshotData(socket) {
        // 100 -> isQueryLeft
        // 133 -> QueryType
        const isQueryLeft = socket[MVParameterKeys.QueryDataLeft].value;
        //const QueryType =  socket[MVParameterKeys.QueryType].value;
        if (!this.GameSnapShotInstances.InitWorld) this.GameSnapShotInstances.InitWorld = [];
        this.GameSnapShotInstances.InitWorld.push(...socket[MVParameterKeys.Data].value);
        if (!isQueryLeft) {
            //console.log(`[${this.instance}]: GameSnapshotData: Ready!`)
            this.GameWorldManager.world = getPackerInfo(this.GameSnapShotInstances.InitWorld);

            //console.log("WorldObjects", this.GameWorldManager.world.WorldObjects.length);
            //console.log("Prototypes", this.GameWorldManager.world.Prototypes.length);

            //delete this.GameSnapShotInstances.InitWorld;
        }
    }
    PendingByteDataBatch(socket) {
        let QueryType = socket[MVParameterKeys.QueryType].value;
        if (QueryType == 2) this.HandleNewWorldObjects(socket);
        if (QueryType == 3) this.HandleAccessories(socket);
    }
    OnPlanetData() {
		
	}
    PlayerPlanetData(socket) {
        let Data = JSON.parse(socket[MVParameterKeys.Data].value);
        //this.OnPlanetData(Data)
        //console.log("PlayerPlanetData: ", Data);
    }
}
class WebSocketManager {
    isXPInstance = false;
    constructor(locateData, onconnected, ondisconnected) {
        this.locateData = locateData;
        this.onConnected = onconnected ?? (() => { });
        this.onDisconnected = ondisconnected ?? (() => { });
    }
    Connect() {
        const { hostName, wssPort } = this.locateData;
        this.ws = new WebSocket('wss://' + hostName + ':' + wssPort + '/', 'GpBinaryV16');
        this.ws.on('open', () => {
            let { instance } = new GameWorldManager();
            this.instance = instance;
            this.GameWorldManager = GameWorldManager.get(instance);
            this.OperationResponseManager = new OperationResponseManager(this);
            this.EventManager = new EventManager(this);
            this.ws.on('message', async (data) => {
                if (data instanceof ArrayBuffer) data = new Uint8Array(data);
                var socket = parseSocket(data);
                var socketName = find(socket.isToClient ? MVOperationCodes : MVEventCodes, data[2]);
                //if (![1, 81].includes(data[2])) console.log(socketName);
                //if (![1, 81].includes(data[2])) console.log(socket);

                if (socket.isToClient) {
                    if (this.OperationResponseManager[socketName]) this.OperationResponseManager[socketName](socket);
                } else if (this.EventManager[socketName]) this.EventManager[socketName](socket);
            });
        });
        this.ws.on('close', (code, reason) => {
            delete GameWorldManager.WorldInstances[this.instance];
            this.onDisconnected(code, reason);
        });
        this.ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    }
    get isClosed() {
        return [this.ws.CLOSED, this.ws.CLOSING].includes(this.ws.readyState);
    }
    OnXPReward(func) {
        this.EventManager.OnXPReward = func;
    }
    OnPlanetData(func) {
        this.EventManager.OnPlanetData = func;
    }
    Follow(ActorNr) {
        this.EventManager.TeleportTarget = ActorNr;
    }
    GetWorld() {
        return this.GameWorldManager.world;
    }
}


module.exports = { WebSocketManager }