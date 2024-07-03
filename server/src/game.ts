import { Emote, PlayerBarn } from "./objects/player";
import { Grid } from "./utils/grid";
import { type GameObject, ObjectRegister } from "./objects/gameObject";
import { type ConfigType } from "./config";
import { GameMap } from "./map";
import { BullletBarn } from "./objects/bullet";
import { Logger } from "./utils/logger";
import * as net from "../../shared/net";
import { DropItemMsg } from "../../shared/msgs/dropItemMsg";
import { EmoteMsg } from "../../shared/msgs/emoteMsg";
import { JoinMsg } from "../../shared/msgs/joinMsg";
import { InputMsg } from "../../shared/msgs/inputMsg";
import { LootBarn } from "./objects/loot";
import { Gas } from "./objects/gas";
import { SpectateMsg } from "../../shared/msgs/spectateMsg";
import { ProjectileBarn } from "./objects/projectile";
import { DeadBodyBarn } from "./objects/deadBody";
import { type PlayerContainer } from "./abstractServer";
import { ExplosionBarn } from "./objects/explosion";
import { ObjectType } from "../../shared/utils/objectSerializeFns";
import { SmokeBarn } from "./objects/smoke";
import { AirdropBarn } from "./objects/airdrop";
import { DecalBarn } from "./objects/decal";
import { GameTerminal } from "./utils/commands";
import { EventType, type EventMap, EventsManager, type GamePlugin } from "./utils/plugins";
import { Clock} from "../../shared/utils/util";
import { MapDefs } from "../../shared/defs/mapDefs";
export interface GameMode{
    maxTeamSize:number,
    map:keyof typeof MapDefs
}
export class Game {
    started = false;
    stopped = false;
    allowJoin = true;
    over = false;
    startedTime = 0;
    id: number;
    config: ConfigType;
    console:GameTerminal

    teamMode:boolean
    mode:GameMode

    grid: Grid;
    objectRegister: ObjectRegister;

    get aliveCount(): number {
        return this.playerBarn.livingPlayers.length;
    }

    msgsToSend: Array<{ type: number, msg: net.AbstractMsg }> = [];

    playerBarn = new PlayerBarn(this);
    lootBarn = new LootBarn(this);
    deadBodyBarn = new DeadBodyBarn(this);
    decalBarn = new DecalBarn(this);
    projectileBarn = new ProjectileBarn(this);
    bulletBarn = new BullletBarn(this);
    smokeBarn = new SmokeBarn(this);
    airdropBarn = new AirdropBarn(this);

    explosionBarn = new ExplosionBarn(this);

    map: GameMap;
    gas: Gas;

    now!: number;

    logger: Logger;

    typeToPool: Record<ObjectType, GameObject[]>;
    readonly events:EventsManager<EventType,EventMap>
    readonly clock:Clock
    running:boolean
    onreport:((container:PlayerContainer)=>void)|undefined=undefined
    constructor(id: number,mode:GameMode, config: ConfigType) {
        this.id = id;
        this.logger = new Logger(`Game #${this.id}`);
        this.logger.log("Creating");
        const start = Date.now();

        this.console=new GameTerminal(this)
        this.config = config;
        this.mode=mode;

        this.clock=new Clock(this.config.tps,1)
        this.map = new GameMap(this);
        this.grid = new Grid(this.map.width, this.map.height);
        this.objectRegister = new ObjectRegister(this.grid);
        this.map.generate()

        this.teamMode=this.map.mapDef.gameMode.teamsMode||this.mode.maxTeamSize>1

        this.gas = new Gas(this.map,this);

        this.allowJoin = true;
        this.events=new EventsManager()
        this.running=false
        this.typeToPool = {
            [ObjectType.Invalid]: [],
            [ObjectType.LootSpawner]: [],
            [ObjectType.Player]: this.playerBarn.players,
            [ObjectType.Obstacle]: this.map.obstacles,
            [ObjectType.Loot]: this.lootBarn.loots,
            [ObjectType.DeadBody]: this.deadBodyBarn.deadBodies,
            [ObjectType.Building]: this.map.buildings,
            [ObjectType.Structure]: this.map.structures,
            [ObjectType.Decal]: this.decalBarn.decals,
            [ObjectType.Projectile]: this.projectileBarn.projectiles,
            [ObjectType.Smoke]: this.smokeBarn.smokes,
            [ObjectType.Airdrop]: this.airdropBarn.airdrops
        };

        this.map.genPlugins()

        this.logger.log(`Created in ${Date.now() - start} ms`);
    }

    start():void{
        this.gas.advanceGasStage();
        this.events.emit(EventType.GameStart,this)
        setTimeout(()=>{
            this.allowJoin=false
            this.logger.log("Closed")
            this.events.emit(EventType.GameClose,this)
        },(this.map.mapDef.gameMode.joinTime??this.config.joinTime)*1000)
    }

    addPlugin(plugin:GamePlugin){
        plugin.game=this
        plugin.initSignals()
    }

    update() {
        const now = Date.now();
        if (!this.now) this.now = now;
        const dt = this.clock.deltaTime;
        this.now = now;
        //
        // Update modules
        //
        this.gas.update(dt);
        this.bulletBarn.update(dt);
        this.lootBarn.update(dt);
        this.projectileBarn.update(dt);
        this.deadBodyBarn.update(dt);
        this.airdropBarn.update(dt)
        this.playerBarn.update(dt);
        this.explosionBarn.update();

        // second update:
        // serialize objects and send msgs
        this.objectRegister.serializeObjs();
        this.playerBarn.sendMsgs();

        //
        // reset stuff
        //
        this.playerBarn.flush();
        this.bulletBarn.flush();
        this.objectRegister.flush();
        this.explosionBarn.flush();
        this.gas.flush();
        this.msgsToSend.length = 0;

        if (this.started && ((this.teamMode&&this.playerBarn.livingTeams.length<=1)||(this.playerBarn.livingPlayers.length<=1)) && !this.over) {
            this.initGameOver();
        }
        this.events.emit(EventType.GameTick,this)
        if(this.running){
            this.clock.tick(this.update.bind(this))
        }
    }
    run(){
        this.running=true
        this.update()
    }

    handleMsg(buff: ArrayBuffer | Buffer, socketData: PlayerContainer): void {
        const msgStream = new net.MsgStream(buff);
        const type = msgStream.deserializeMsgType();
        const stream = msgStream.stream;

        const player = socketData.player;

        if (type === net.MsgType.Join && !player) {
            const joinMsg = new JoinMsg();
            joinMsg.deserialize(stream);
            this.playerBarn.addPlayer(socketData, joinMsg);
            return;
        }

        if (!player) {
            socketData.closeSocket();
            return;
        }

        switch (type) {
        case net.MsgType.Report:{
            if(player.spectating&&this.onreport){
                this.onreport!(socketData)
            }
            break
        }
        case net.MsgType.Input: {
            const inputMsg = new InputMsg();
            inputMsg.deserialize(stream);
            player.handleInput(inputMsg);
            break;
        }
        case net.MsgType.Emote: {
            const emoteMsg = new EmoteMsg();
            emoteMsg.deserialize(stream);

            this.playerBarn.emotes.push(new Emote(
                player.__id,
                emoteMsg.pos,
                emoteMsg.type,
                emoteMsg.isPing
            ));
            break;
        }
        case net.MsgType.DropItem: {
            const dropMsg = new DropItemMsg();
            dropMsg.deserialize(stream);
            player.dropItem(dropMsg);
            break;
        }
        case net.MsgType.Spectate: {
            const spectateMsg = new SpectateMsg();
            spectateMsg.deserialize(stream);
            player.spectate(spectateMsg);
            break;
        }
        }
    }

    initGameOver(): void {
        if (this.over) return;
        this.over = true;
        const winningPlayers = this.teamMode?this.playerBarn.teams[this.playerBarn.livingTeams[0]]!.players:this.playerBarn.livingPlayers;
        if (winningPlayers.length>0) {
            for(const p of winningPlayers){
                p.addGameOverMsg(p.teamId);
                for (const spectator of p.spectators) {
                    spectator.addGameOverMsg(p.teamId);
                }
            }
        }
        this.events.emit(EventType.GameEnd,{game:this,winners:this.playerBarn.livingPlayers})
        setTimeout(() => {
            this.stop();
        }, 2000);
    }

    stop(): void {
        if (this.stopped) return;
        this.stopped = true;
        this.running=false
        this.allowJoin = false;
        for (const player of this.playerBarn.players) {
            if (!player.disconnected) {
                player.closeSocket();
            }
        }
        this.logger.log("Game Ended");
    }
}
