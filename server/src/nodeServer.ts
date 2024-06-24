import { Config } from "./config";
import {
    App,
    type HttpResponse,
    SSLApp,
    type WebSocket,
    type TemplatedApp
} from "uWebSockets.js";
import NanoTimer from "nanotimer";
import { URLSearchParams } from "node:url";
import { AbstractServer, type PlayerContainer } from "./abstractServer";

/**
 * Apply CORS headers to a response.
 * @param res The response sent by the server.
 */
function cors(res: HttpResponse): void {
    res.writeHeader("Access-Control-Allow-Origin", "*")
        .writeHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        .writeHeader("Access-Control-Allow-Headers", "origin, content-type, accept, x-requested-with")
        .writeHeader("Access-Control-Max-Age", "3600");
}

function forbidden(res: HttpResponse): void {
    res.writeStatus("403 Forbidden").end("403 Forbidden");
}

/**
 * Read the body of a POST request.
 * @link https://github.com/uNetworking/uWebSockets.js/blob/master/examples/JsonPost.js
 * @param res The response from the client.
 * @param cb A callback containing the request body.
 * @param err A callback invoked whenever the request cannot be retrieved.
 */
function readPostedJSON<T>(
    res: HttpResponse,
    cb: (json: T) => void,
    err: () => void
): void {
    let buffer: Buffer | Uint8Array;
    /* Register data cb */
    res.onData((ab, isLast) => {
        const chunk = Buffer.from(ab);
        if (isLast) {
            let json: T;
            if (buffer) {
                try {
                    // @ts-expect-error JSON.parse can accept a Buffer as an argument
                    json = JSON.parse(Buffer.concat([buffer, chunk]));
                } catch (e) {
                    /* res.close calls onAborted */
                    res.close();
                    return;
                }
                cb(json);
            } else {
                try {
                    // @ts-expect-error JSON.parse can accept a Buffer as an argument
                    json = JSON.parse(chunk);
                } catch (e) {
                    /* res.close calls onAborted */
                    res.close();
                    return;
                }
                cb(json);
            }
        } else {
            if (buffer) {
                buffer = Buffer.concat([buffer, chunk]);
            } else {
                buffer = Buffer.concat([chunk]);
            }
        }
    });

    /* Register error cb */
    res.onAborted(err);
}

class NodeServer extends AbstractServer {
    app: TemplatedApp;

    constructor() {
        super();

        const app = this.app = Config.ssl
            ? SSLApp({
                key_file_name: Config.ssl.keyFile,
                cert_file_name: Config.ssl.certFile,
                ca_file_name:Config.ssl.caFile
            })
            : App();

        app.get("/api/site_info", (res) => {
            let aborted = false;
            res.onAborted(() => { aborted = true; });
            cors(res);
            const data = this.getSiteInfo();
            if (!aborted) {
                res.writeHeader("Content-Type","application/json")
                res.end(JSON.stringify(data));
            }
        });
        app.post("/api/user/profile", (res, _req) => {
            res.writeHeader("Content-Type", "application/json");
            res.end(JSON.stringify(this.getUserProfile()));
        });
        app.post("/api/find_game", (res) => {
            readPostedJSON(res, (_body: {version:number}) => {
                const response = this.findGame();
                cors(res)
                res.writeHeader("Content-Type", "application/json");
                res.end(JSON.stringify(response));
            }, () => {
                this.logger.warn("/api/find_game: Error retrieving body");
            });
        });
        app.get("/api/find_game",(res)=>{
            const response = this.findGame();
            cors(res)
            res.end(JSON.stringify(response));
        })

        const This = this;

        app.ws("/play", {
            idleTimeout: 30,
            /**
            * Upgrade the connection to WebSocket.
            */
            upgrade(res, req, context) {
                /* eslint-disable-next-line @typescript-eslint/no-empty-function */
                res.onAborted((): void => { });

                const searchParams = new URLSearchParams(req.getQuery());
                const gameID = This.getGameId(searchParams);

                if (gameID !== false) {
                    res.upgrade(
                        {
                            gameID
                        },
                        req.getHeader("sec-websocket-key"),
                        req.getHeader("sec-websocket-protocol"),
                        req.getHeader("sec-websocket-extensions"),
                        context
                    );
                } else {
                    forbidden(res);
                }
            },

            /**
             * Handle opening of the socket.
             * @param socket The socket being opened.
             */
            open(socket: WebSocket<PlayerContainer>) {
                socket.getUserData().sendMsg = (data) => {
                    socket.send(data, true, false);
                };
                socket.getUserData().closeSocket = () => {
                    socket.close();
                };
                This.onOpen(socket.getUserData());
            },

            /**
             * Handle messages coming from the socket.
             * @param socket The socket in question.
             * @param message The message to handle.
             */
            message(socket: WebSocket<PlayerContainer>, message) {
                This.onMessage(socket.getUserData(), message);
            },

            /**
             * Handle closing of the socket.
             * @param socket The socket being closed.
             */
            close(socket: WebSocket<PlayerContainer>) {
                This.onClose(socket.getUserData());
            }

        });

        app.listen(Config.host, Config.port, (): void => {
            this.init();

            const timer = new NanoTimer();

            timer.setInterval(() => { this.tick(); }, "", `${1000 / Config.tps}m`);
        });
    }
}

new NodeServer();
