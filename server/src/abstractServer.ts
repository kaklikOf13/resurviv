import { type URLSearchParams } from "url";
import { Config } from "./config";
import { Game, GameMode } from "./game";
import { type Player } from "./objects/player";
import { Logger } from "./utils/logger";
import { version } from "../../package.json";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { ReportMsg } from "../../shared/msgs/reportMsg";
import { isRotation, rotate, TimeRotation, util } from "../../shared/utils/util";
import * as net from "../../shared/net";

export interface PlayerContainer {
    readonly gameID: number
    sendMsg: (msg: ArrayBuffer | Uint8Array) => void
    closeSocket: () => void
    player?: Player
    readonly ip:string
}
export enum PunishmentType{
    Ban,
    TempBan,
    Warn,
}
export type Punishment={
    type:PunishmentType.Ban
    ip:string,
    name:string,
    reason:string
}|{
    type:PunishmentType.TempBan
    ip:string,
    name:string,
    reason:string,
    expiresOn:string,
}|{
    type:PunishmentType.Warn
    ip:string,
    name:string,
    reason:string,
}
export abstract class AbstractServer {
    readonly logger = new Logger("Server");

    readonly games: Partial<Record<number,Game | undefined>> = [];

    main:boolean=true

    rotations:Record<number,{acd:number,idx:number}>={}

    init(): void {
        this.logger.log(`Resurviv Server v${version}`);
        this.logger.log("Press Ctrl+C to exit.");

        if(Config.punishmentsDatabase===""&&!existsSync("./punishments")){
            this.initPunishments()
        }
        if(!existsSync("./reports")){
            mkdirSync("./reports")
        }

        //this.newGame(0);
    }

    execute(cmd:string,gameID:number): void {
        if(this.games[gameID]){
            this.games[gameID]!.console.execute(cmd)
        }
    }

    getMode(idx:number=0):GameMode{
        if(isRotation(Config.modes[idx])){
            if(this.rotations[idx]){
                this.rotations[idx]=rotate(Config.modes[idx] as TimeRotation<GameMode>,this.rotations[idx].idx,this.rotations[idx].acd)
            }else{
                this.rotations[idx]=rotate(Config.modes[idx] as TimeRotation<GameMode>,0,Date.now())
            }
            return (Config.modes[idx] as TimeRotation<GameMode>).rotation[this.rotations[idx].idx]
        }
        return Config.modes[idx] as GameMode
    }

    newGame(id?: number,mode:number=0): number {
        if (id !== undefined) {
            if (!this.games[id] || this.games[id]?.stopped) {
                this.games[id] = new Game(id,this.getMode(mode), Config);
                this.games[id]!.onreport=(this.onreport.bind(this))
                this.games[id]?.run()
                return id;
            }
        } else {
            for (let i = 0; i < Config.maxGames; i++) {
                if (!this.games[i] || this.games[i]?.stopped) return this.newGame(i,mode);
            }
        }
        return -1;
    }

    endGame(id: number, createNewGame: boolean): void {
        const game = this.games[id];
        if (game === undefined) return;
        game.stop();
        if (createNewGame) {
            this.newGame(id)
        } else {
            delete this.games[id];
        }
    }

    canJoin(game?: Game): boolean {
        return game !== undefined && game.aliveCount < game.map.mapDef.gameMode.maxPlayers && !game.over;
    }

    async getInfo() {
        let playerCount = 0
        Object.values(this.games).forEach((a,_) => {
            playerCount+=(a ? a.playerBarn.livingPlayers.length : 0);
        }, 0);
        if(this.main){
            for(const p of Config.childPorts){
                try{
                    const ip=`http${Config.ssl?"s":""}://localhost:${p}/api/info`
                    const js=await(await fetch(ip)).json()
                    playerCount+=js["players"]
                }catch{
                    playerCount+=0
                }
            }
        }

        const data = {
            modes: new Array<any>(),
            players: playerCount,
            country: Config.country,
            childPorts:Config.childPorts
        };
        for(let m=0;m<Config.modes.length;m++){
            const mm=this.getMode(m)
            data.modes.push({teamMode:mm.maxTeamSize,mapName:mm.map})
        }
        return data;
    }

    getUserProfile() {
        return { err: "" };
    }

    initPunishments(){
        mkdirSync("./punishments")
        mkdirSync("./punishments/warns")
        mkdirSync("./punishments/bans")
        mkdirSync("./punishments/tempBans")
    }
    getPunishmentFile(ip:string,warn:boolean=false):Punishment|null{
        if(!existsSync("./punishments")){
            this.initPunishments()
        }
        const name=ip+".json"
        if(warn){
            if(existsSync(`./punishments/warns/${name}`)){
                return JSON.parse(readFileSync(`./punishments/warns/${name}`,"utf-8").toString())
            }
        }
        if(existsSync(`./punishments/bans/${name}`)){
            return JSON.parse(readFileSync(`./punishments/bans/${name}`,"utf-8").toString())
        }
        if(existsSync(`./punishments/tempBans/${name}`)){
            return JSON.parse(readFileSync(`./punishments/tempBans/${name}`,"utf-8").toString())
        }
        return null
    }
    async getPunishment(ip:string,warn:boolean):Promise<Punishment|null>{
        if(Config.punishmentsDatabase===""){
            return this.getPunishmentFile(ip,warn)
        }
        try{
            const punishment=await(await fetch(Config.punishmentsDatabase+`/api/punishment/${warn ? "warn" : ""}`,{
                method:"POST",
                body:JSON.stringify({
                    ip:ip,
                }),
                mode:"no-cors",
            })).json()
            return punishment as Punishment
        }catch{
            return null
        }finally{
            return null
        }
    }
    removePunishment(ip:string,type:PunishmentType,idx?:number){
        try{
            const name=ip+".json"
            switch(type){
                case PunishmentType.Ban:
                    rmSync(`./punishments/bans/${name}`)
                case PunishmentType.TempBan:
                    rmSync(`./punishments/tempBans/${name}`)
                case PunishmentType.Warn:
                    rmSync(`./punishments/warns/${name}`)
            }
        }catch{}
    }
    addPunishment(p:Punishment){
        try{
            const name=p.ip+".json"
            switch(p.type){
                case PunishmentType.Ban:
                    writeFileSync(`./punishments/bans/${name}`,JSON.stringify(p),"utf-8")
                case PunishmentType.TempBan:
                    writeFileSync(`./punishments/tempBans/${name}`,JSON.stringify(p),"utf-8")
                case PunishmentType.Warn:
                    writeFileSync(`./punishments/warns/${name}`,JSON.stringify(p),"utf-8")
            }
        }catch{}
    }
    async playerCanJoin(ip:string):Promise<boolean>{
        const p=await this.getPunishment(ip,false)
        if(!p){
            return true
        }
        switch(p?.type){
            case PunishmentType.Ban:
                return false
            case PunishmentType.TempBan:
                if(new Date(p.expiresOn).getTime() < Date.now()){
                    this.removePunishment(ip,PunishmentType.TempBan)
                    return true
                }
                return false
        }
        return true
    }

    createReport(code:string,player:Player){
        writeFileSync(`./reports/${code}.json`,JSON.stringify({"name":player.name,"ip":player.__ip,"data":new Date(Date.now()).toDateString()}))
    }

    onreport(container:PlayerContainer){
        if(!container.player){
            return
        }
        const msg=new ReportMsg()
        let code=container.player.reportCode
        while(code===""){
            code=util.randomString(10)
            if(existsSync(`./reports/${code}`)){
                code=""
            }
        }
        container.player!.reportCode=code
        if(!existsSync(`./reports/${code}`)){
            this.createReport(code,container.player.spectating as Player)
        }
        msg.code=code
        container.player.msgsToSend.push({type:net.MsgType.Report,msg:msg})
    }

    findGame(mode:number) {
        let response: {
            gameId: number,
            data:string
        } | { err: string } = {
            gameId: 0,
            data:""
        };

        let foundGame = false;
        for (let gameID = Config.maxGames; gameID >=0; gameID--) {
            const game = this.games[gameID];
            if(!this.games[gameID]){
                continue
            }
            if(this.games[gameID]?.stopped){
                this.endGame(gameID,false)
            }
            const mm=this.getMode(mode)
            if (this.canJoin(game) && game?.allowJoin && game.mode.map==mm.map&&game.mode.maxTeamSize==mm.maxTeamSize) {
                response.gameId = game.id;
                foundGame = true;
                break;
            }
        }
        if (!foundGame) {
            // Create a game if there's a free slot
            const gameID = this.newGame(undefined,mode);
            if (gameID !== -1) {
                response.gameId = gameID;
            } else {
                response = { err: "failed finding game" };
            }
        }
        return response
    }

    async getGameId(params: URLSearchParams,ip:string): Promise<false | number> {
        //
        // Validate game ID
        //
        if(!await this.playerCanJoin(ip)){
            return false
        }
        let gameID = Number(params.get("gameID"));
        if (gameID < 0 || gameID > Config.maxGames - 1) gameID = 0;
        if (!this.canJoin(this.games[gameID])) {
            return false;
        }
        return gameID;
    }

    onOpen(data: PlayerContainer): void {
        const game = this.games[data.gameID];
        if (game === undefined) {
            data.closeSocket();
        }
    }

    onMessage(data: PlayerContainer, message: ArrayBuffer | Buffer) {
        const game = this.games[data.gameID];
        if (!game) {
            data.closeSocket();
            return;
        }
        try {
            game.handleMsg(message, data);
        } catch (e) {
            console.warn("Error parsing message:", e);
        }
    }

    onClose(data: PlayerContainer): void {
        const game = this.games[data.gameID];
        const player = data.player;
        if (game === undefined || player === undefined) return;
        game.logger.log(`"${player.name}" left`);
        player.disconnected = true;
    }
}
