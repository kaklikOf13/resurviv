import { Config } from "./config";
import {
    App,
    type HttpResponse,
    SSLApp,
    type WebSocket,
    type TemplatedApp,
    HttpRequest
} from "uWebSockets.js";
import NanoTimer from "nanotimer";
import { URLSearchParams } from "node:url";
import jwt from 'jsonwebtoken';
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
interface IpRecord {
    count: number;
    timestamp: number;
  }
let ipRequestCounts: Record<string, IpRecord> = {};

function rateLimitMiddleware(res: HttpResponse, req: HttpRequest, next: () => void): void {
    if(!(Config.security&&Config.security.antiddos)){
        next()
        return
    }
    const ip = req.getHeader('x-forwarded-for') || Buffer.from(res.getRemoteAddressAsText()).toString();
    if (!ipRequestCounts[ip]) {
      ipRequestCounts[ip] = { count: 1, timestamp: Date.now() };
    } else {
      const currentTime = Date.now();
      const timeDifference = currentTime - ipRequestCounts[ip].timestamp;
      if (timeDifference > Config.security.antiddos.window_limit) {
        ipRequestCounts[ip] = { count: 1, timestamp: currentTime };
      } else {
        ipRequestCounts[ip].count++;
      }
      if (ipRequestCounts[ip].count >Config.security.antiddos.limit_request) {
        res.writeStatus('429 Too Many Requests').end('Too Many Requests');
        return;
      }
    }
    next();
}
function authenticate(password: string): string | null {
    let tpassword="123"
    if(Config.security&&Config.security.terminalPassword){
        tpassword=Config.security.terminalPassword
    }
    let key="key"
    if(Config.security&&Config.security.adminCryptKey){
        key=Config.security.adminCryptKey
    }
    if (password==tpassword) {
      const token = jwt.sign({}, key, { expiresIn: '1h' });
      return token;
    }
    return null;
}
function authMiddleware(res: HttpResponse, req: HttpRequest, next: () => void) {
    // Simulação de autenticação via headers ou cookies (melhorar para produção)
    const token = req.getHeader('Authorization');
    if (token === 'valid-token') { // Simplificado, use tokens JWT na prática
        return token;
    } else {
        res.writeStatus('401 Unauthorized').end('Access denied');
    }
}
export class NodeServer extends AbstractServer {
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
        app.get("/api/info", (res,req) => {
            rateLimitMiddleware(res,req,()=>{
                let aborted = false;
                res.onAborted(() => { aborted = true; });
                cors(res);
                const data = this.getInfo();
                if (!aborted) {
                    res.writeHeader("Content-Type","application/json")
                    res.end(JSON.stringify(data));
                }
            })
        });
        app.post("/api/user/profile", (res, req) => {
            rateLimitMiddleware(res,req,()=>{
                res.writeHeader("Content-Type", "application/json");
                res.end(JSON.stringify(this.getUserProfile()));
            })
        });
        app.post("/api/find_game", (res, req) => {
            rateLimitMiddleware(res,req,()=>{
                readPostedJSON(res, (_body: {version:number,mode:number}) => {
                    const response = this.findGame(_body.mode);
                    cors(res)
                    res.writeHeader("Content-Type", "application/json");
                    res.end(JSON.stringify(response));
                }, () => {
                    this.logger.warn("/api/find_game: Error retrieving body");
                });
            })
        });
        app.get("/api/find_game",(res,req)=>{
            rateLimitMiddleware(res,req,()=>{
                const params=new URLSearchParams(req.getQuery());
                const gameMode = Number(params.get("gameMode")||"0");
                const response = this.findGame(gameMode);
                cors(res)
                res.end(JSON.stringify(response));
            })
        })
        app.post('/api/admin/login', (res, req) => {
            rateLimitMiddleware(res,req,()=>{
                let buffer = '';
                res.onData((chunk, isLast) => {
                    buffer += Buffer.from(chunk).toString();
                    if (isLast) {
                        const { password } = JSON.parse(buffer);
                        if (authenticate(password)) {
                            res.writeStatus('200 OK').end('Login successful');
                        } else {
                            res.writeStatus('401 Unauthorized').end('Invalid credentials');
                        }
                    }
                });
            })
        })
        app.post('api/admin/execute',(res,req)=>{
            authMiddleware(res,req,()=>{
                readPostedJSON(res,(js)=>{
                    console.log(js)
                },()=>{})
            })
        })

        const This = this;

        app.ws("/play", {
            idleTimeout: 30,
            /**
            * Upgrade the connection to WebSocket.
            */
            upgrade(res, req, context) {
                rateLimitMiddleware(res,req,async()=>{
                    /* eslint-disable-next-line @typescript-eslint/no-empty-function */
                    res.onAborted((): void => { });
                    const enc = new TextDecoder();
                    const searchParams = new URLSearchParams(req.getQuery());
                    const ip=enc.decode(res.getRemoteAddressAsText())
                    const gameID = await This.getGameId(searchParams,ip);
                    if (gameID !== false) {
                        res.upgrade(
                            {
                                gameID,
                                ip
                            },
                            req.getHeader("sec-websocket-key"),
                            req.getHeader("sec-websocket-protocol"),
                            req.getHeader("sec-websocket-extensions"),
                            context
                        );
                    } else {
                        forbidden(res);
                    }
                })
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
    }
    run(port=Config.port){
        this.app.listen(Config.host, port, (): void => {
            this.init();
        });
    }
    stop(){
        this.app.close()
    }
}