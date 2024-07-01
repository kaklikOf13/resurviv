import { type URLSearchParams } from "url";
import { Config } from "./config";
import { Game } from "./game";
import { type Player } from "./objects/player";
import { Logger } from "./utils/logger";
import { version } from "../../package.json";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { ReportMsg } from "../../shared/msgs/reportMsg";
import { util } from "../../shared/utils/util";
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

    readonly games: Record<number,Game | undefined> = [];

    init(): void {
        this.logger.log(`Resurviv Server v${version}`);
        this.logger.log(`Listening on ${Config.host}:${Config.port}`);
        this.logger.log("Press Ctrl+C to exit.");

        if(Config.punishmentsDatabase===""&&!existsSync("./punishments")){
            this.initPunishments()
        }
        if(!existsSync("./reports")){
            mkdirSync("./reports")
        }

        this.newGame(0);

        setInterval(() => {
            const memoryUsage = process.memoryUsage().rss;
            const perfString = `Memory usage: ${Math.round(memoryUsage / 1024 / 1024 * 100) / 100} MB`;

            this.logger.log(perfString);
        }, 60000);
    }

    execute(cmd:string,gameID:number): void {
        if(this.games[gameID]){
            this.games[gameID]!.console.execute(cmd)
        }
    }

    newGame(id?: number): number {
        if (id !== undefined) {
            if (!this.games[id] || this.games[id]?.stopped) {
                this.games[id] = new Game(id, Config);
                //@ts-expect-error
                this.games[id].onreport=(this.onreport.bind(this))
                this.games[id]?.run()
                return id;
            }
        } else {
            for (let i = 0; i < Config.maxGames; i++) {
                if (!this.games[i] || this.games[i]?.stopped) return this.newGame(i);
            }
        }
        return -1;
    }

    endGame(id: number, createNewGame: boolean): void {
        const game = this.games[id];
        if (game === undefined) return;
        game.stop();
        if (createNewGame) {
            this.games[id] = new Game(id, Config);
        } else {
            delete this.games[id];
        }
    }

    canJoin(game?: Game): boolean {
        return game !== undefined && game.aliveCount < game.map.mapDef.gameMode.maxPlayers && !game.over;
    }

    getSiteInfo() {
        let playerCount = 0
        Object.values(this.games).forEach((a,_) => {
            playerCount+=(a ? a.playerBarn.livingPlayers.length : 0);
        }, 0);

        const data = {
            modes: [
                { mapName: Config.map, teamMode: 1 }
            ],
            players: playerCount,
            country: Config.country
        };
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

    findGame() {
        let response: {
            gameId: number,
            data: string
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
            if (this.canJoin(game) && game?.allowJoin) {
                response.gameId = game.id;
                foundGame = true;
                break;
            }
        }
        if (!foundGame) {
            // Create a game if there's a free slot
            const gameID = this.newGame();
            if (gameID !== -1) {
                response.gameId = gameID;
            } else {
                // Join the game that most recently started
                const game = Object.values(this.games)
                    .filter(g => g && !g.over)
                    .reduce((a, b) => (a!).startedTime > (b!).startedTime ? a : b);

                if (game) response.gameId = game.id;
                else response = { err: "failed finding game" };
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
