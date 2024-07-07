import { EmotesDefs } from "../shared/defs/gameObjects/emoteDefs";
import { MeleeDefs } from "../shared/defs/gameObjects/meleeDefs";
import { OutfitDefs } from "../shared/defs/gameObjects/outfitDefs";
import { UnlockDefs } from "../shared/defs/gameObjects/unlockDefs";
import { GameConfig } from "../shared/gameConfig";
import * as net from "../shared/net";
import * as messages from "../shared/messages";
import {
    type ObjectData,
    ObjectType,
    type ObjectsPartialData
} from "../shared/utils/objectSerializeFns";
import { util } from "../shared/utils/util";
import { v2 } from "../shared/utils/v2";
import { WebSocket } from "ws";
import { GunDefs } from "../shared/defs/gameObjects/gunDefs";

const config = {
    address: "localhost:8000",
    gameModeIdx: 1,
    botCount: 19,
    joinDelay: 100
};

//
// Cache random loadout types
//

const outfits: string[] = [];
for (const outfit in OutfitDefs) {
    if (!UnlockDefs.unlock_default.unlocks.includes(outfit)) continue;
    outfits.push(outfit);
}

const emotes: string[] = [];
for (const emote in EmotesDefs) {
    if (!UnlockDefs.unlock_default.unlocks.includes(emote)) continue;
    emotes.push(emote);
}

const melees: string[] = [];
for (const melee in MeleeDefs) {
    if (!UnlockDefs.unlock_default.unlocks.includes(melee)) continue;
    melees.push(melee);
}

const guns: string[] = [];
for (const gun in GunDefs) {
    if (!UnlockDefs.unlock_default.unlocks.includes(gun)) continue;
    guns.push(gun);
}

const bots = new Set<Bot>();

let allBotsJoined = false;

interface GameObject {
    __id: number;
    __type: ObjectType;
    data: ObjectData<ObjectType>;
}

class ObjectCreator {
    idToObj: Record<number, GameObject> = {};

    getObjById(id: number) {
        return this.idToObj[id];
    }

    getTypeById(id: number, s: net.BitStream) {
        const obj = this.getObjById(id);
        if (!obj) {
            const err = {
                id,
                ids: Object.keys(this.idToObj),
                stream: s._view._view
            };
            console.error("objectPoolErr", `getTypeById${JSON.stringify(err)}`);
            return ObjectType.Invalid;
        }
        return obj.__type;
    }

    updateObjFull<Type extends ObjectType>(
        type: Type,
        id: number,
        data: ObjectData<Type>
    ) {
        let obj = this.getObjById(id);
        if (obj === undefined) {
            obj = {} as GameObject;
            obj.__id = id;
            obj.__type = type;
            this.idToObj[id] = obj;
        }
        obj.data = data;
        return obj;
    }

    updateObjPart<Type extends ObjectType>(id: number, data: ObjectsPartialData[Type]) {
        const obj = this.getObjById(id);
        if (obj) {
            for (const dataKey in data) {
                //@ts-expect-error
                obj.data[dataKey] = data;
            }
        } else {
            console.error("updateObjPart, missing object", id);
        }
    }

    deleteObj(id: number) {
        const obj = this.getObjById(id);
        if (obj === undefined) {
            console.error("deleteObj, missing object", id);
        } else {
            delete this.idToObj[id];
        }
    }
}

class Bot {
    moving = {
        up: false,
        down: false,
        left: false,
        right: false
    };

    shootStart = false;

    interact = false;

    emotes: string[];

    emote = false;

    angle = util.random(-Math.PI, Math.PI);
    angularSpeed = util.random(0, 0.1);

    toMouseLen = 50;

    connected = false;

    disconnect = false;

    id: number;

    ws: WebSocket;

    objectCreator = new ObjectCreator();
    target:GameObject|undefined

    constructor(id: number, gameID: number) {
        this.id = id;

        this.ws = new WebSocket(`ws://${config.address}/play?gameId=${gameID}`);

        this.ws.on("error", console.log);

        this.ws.on("open", this.join.bind(this));

        this.ws.on("close", () => {
            this.disconnect = true;
            this.connected = false;
        });

        this.ws.binaryType = "arraybuffer";

        const emote = (): string => emotes[util.randomInt(0, emotes.length - 1)];

        this.emotes = [emote(), emote(), emote(), emote(), emote(), emote()];

        this.ws.on("message",(message: ArrayBuffer): void => {
            const stream = new net.MsgStream(message);
            while (true) {
                const type = stream.deserializeMsgType();
                if (type == messages.MsgType.None) {
                    break;
                }
                this.onMsg(type, stream.getStream());
            }
        })
    }

    onMsg(type: number, stream: net.BitStream): void {
        switch (type) {
            case messages.MsgType.Joined: {
                const msg = new messages.JoinedMsg();
                msg.deserialize(stream);
                this.emotes = msg.emotes;
                break;
            }
            case messages.MsgType.Map: {
                const msg = new messages.MapMsg();
                msg.deserialize(stream);
                break;
            }
            case messages.MsgType.Update: {
                const msg = new messages.UpdateMsg();
                msg.deserialize(stream, this.objectCreator);

                // Delete objects
                for (let i = 0; i < msg.delObjIds.length; i++) {
                    this.objectCreator.deleteObj(msg.delObjIds[i]);
                }

                // Update full objects
                for (let i = 0; i < msg.fullObjects.length; i++) {
                    const obj = msg.fullObjects[i];
                    this.objectCreator.updateObjFull(obj.__type, obj.__id, obj);
                }

                // Update partial objects
                for (let i = 0; i < msg.partObjects.length; i++) {
                    const obj = msg.partObjects[i];
                    this.objectCreator.updateObjPart(obj.__id, obj);
                }

                break;
            }
            case messages.MsgType.Kill: {
                const msg = new messages.KillMsg();
                msg.deserialize(stream);
                break;
            }
            case messages.MsgType.RoleAnnouncement: {
                const msg = new messages.RoleAnnouncementMsg();
                msg.deserialize(stream);
                break;
            }
            case messages.MsgType.PlayerStats: {
                const msg = new messages.PlayerStatsMsg();
                msg.deserialize(stream);
                break;
            }
            case messages.MsgType.GameOver: {
                const msg = new messages.GameOverMsg();
                msg.deserialize(stream);
                console.log(
                    `Bot ${this.id} ${msg.gameOver ? "won" : "died"} | kills: ${msg.playerStats[0].kills} | rank: ${msg.teamRank}`
                );
                this.disconnect = true;
                this.connected = false;
                this.ws.close();
                break;
            }
            case messages.MsgType.Pickup: {
                const msg = new messages.PickupMsg();
                msg.deserialize(stream);
                break;
            }
            case messages.MsgType.AliveCounts: {
                const msg = new messages.AliveCountsMsg();
                msg.deserialize(stream);
                break;
            }
            case messages.MsgType.Disconnect: {
                const msg = new messages.DisconnectMsg();
                msg.deserialize(stream);
            }
        }
    }

    stream = new net.MsgStream(new ArrayBuffer(1024));

    join(): void {
        this.connected = true;

        const joinMsg = new messages.JoinMsg();

        joinMsg.name = `BOT_${this.id}`;
        joinMsg.isMobile = false;
        joinMsg.protocol = GameConfig.protocolVersion;

        joinMsg.loadout = {
            melee: melees[util.randomInt(0, melees.length - 1)],
            outfit: outfits[util.randomInt(0, outfits.length - 1)],
            heal: "heal_basic",
            boost: "boost_basic",
            gun:guns[util.randomInt(0, guns.length - 1)],
            gun2:guns[util.randomInt(0, guns.length - 1)],
            emotes: this.emotes
        };
        this.sendMsg(messages.MsgType.Join, joinMsg);
    }

    sendMsg(type: messages.MsgType, messages: net.Msg): void {
        this.stream.stream.index = 0;
        this.stream.serializeMsg(type, messages);

        this.ws.send(this.stream.getBuffer());
    }

    sendInputs(): void {
        if (!this.connected) return;

        if(!this.target){
            /*this.target=Object.values(this.objectCreator.idToObj).reduce((val1,val2)=>{
                switch(val2.__type){
                    case ObjectType.Player:{
                        if(val1.__type==ObjectType.Player&&v2.distance(val1.data["pos"])){

                        }
                        return val2
                        break
                    }
                }
            })*/
           this.target=Object.values(this.objectCreator).find((v:GameObject)=>{
                return v.__type==ObjectType.Player
           })
        }
        const inputPacket = new messages.InputMsg();

        inputPacket.moveDown = this.moving.down;
        inputPacket.moveUp = this.moving.up;
        inputPacket.moveLeft = this.moving.left;
        inputPacket.moveRight = this.moving.right;

        inputPacket.shootStart = this.shootStart;

        inputPacket.toMouseDir = v2.create(Math.cos(this.angle), Math.sin(this.angle));
        inputPacket.toMouseLen = this.toMouseLen;

        this.angle += this.angularSpeed;
        if (this.angle > Math.PI) this.angle = -Math.PI;

        if (this.interact) {
            inputPacket.addInput(GameConfig.Input.Interact);
        }

        this.sendMsg(messages.MsgType.Input, inputPacket);

        if (this.emote) {
            const emoteMsg = new messages.EmoteMsg();
            emoteMsg.type = this.emotes[util.randomInt(0, this.emotes.length - 1)];
        }
    }

    updateInputs(): void {
        this.moving = {
            up: false,
            down: false,
            left: false,
            right: false
        };

        this.shootStart = Math.random() < 0.5;
        this.interact = Math.random() < 0.5;
        this.emote = Math.random() < 0.5;

        switch (util.randomInt(1, 8)) {
            case 1:
                this.moving.up = true;
                break;
            case 2:
                this.moving.down = true;
                break;
            case 3:
                this.moving.left = true;
                break;
            case 4:
                this.moving.right = true;
                break;
            case 5:
                this.moving.up = true;
                this.moving.left = true;
                break;
            case 6:
                this.moving.up = true;
                this.moving.right = true;
                break;
            case 7:
                this.moving.down = true;
                this.moving.left = true;
                break;
            case 8:
                this.moving.down = true;
                this.moving.right = true;
                break;
        }
    }
}

void (async () => {
    for (let i = 1; i <= config.botCount; i++) {
        setTimeout(async () => {
            const response = await (await fetch(`http://${config.address}/api/find_game?gameMode=${config.gameModeIdx}`)).json()
            bots.add(new Bot(i, response.gameId));
            if (i === config.botCount) allBotsJoined = true;
        }, i * config.joinDelay);
    }
})();

setInterval(() => {
    for (const bot of bots) {
        if (Math.random() < 0.02) bot.updateInputs();

        bot.sendInputs();

        if (bot.disconnect) {
            bots.delete(bot);
        }
    }

    if (bots.size === 0 && allBotsJoined) {
        console.log("All bots died or disconnected, exiting.");
        process.exit();
    }
}, 30);