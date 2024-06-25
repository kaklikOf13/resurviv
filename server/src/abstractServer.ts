import { type URLSearchParams } from "url";
import { Config } from "./config";
import { Game } from "./game";
import { type Player } from "./objects/player";
import { Logger } from "./utils/logger";
import { version } from "../../package.json";

export interface PlayerContainer {
    readonly gameID: number
    sendMsg: (msg: ArrayBuffer | Uint8Array) => void
    closeSocket: () => void
    player?: Player
}

export abstract class AbstractServer {
    readonly logger = new Logger("Server");

    readonly games: Record<number,Game | undefined> = [];

    init(): void {
        this.logger.log(`Resurviv Server v${version}`);
        this.logger.log(`Listening on ${Config.host}:${Config.port}`);
        this.logger.log("Press Ctrl+C to exit.");

        this.newGame(0);

        setInterval(() => {
            const memoryUsage = process.memoryUsage().rss;
            const perfString = `Memory usage: ${Math.round(memoryUsage / 1024 / 1024 * 100) / 100} MB`;

            this.logger.log(perfString);
        }, 60000);
    }

    tick(): void {
        for (const game of Object.values(this.games)) {
            if (game) game.update();
        }
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
            playerCount+=(a ? a.playerBarn.players.length : 0);
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

    getGameId(params: URLSearchParams): false | number {
        //
        // Validate game ID
        //
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
