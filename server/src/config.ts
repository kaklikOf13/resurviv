import { type MapDefs } from "../../shared/defs/mapDefs";
import { type Vec2 } from "../../shared/utils/v2";

export enum SpawnMode {
    Random,
    Radius,
    Fixed,
    Center
}

export const Config = {
    host: "0.0.0.0",
    port: 8000,

    map: "main",

    spawn: { mode: SpawnMode.Random },

    maxGames: 3,
    joinTime: 60,

    tps: 30,

    country:"US",

    security:{
        antiddos:{
            limit_request:25,
            window_limit_window:50*1000
        },
        autoReload:true,
        adminCryptKey:"admin",
        terminalPassword:"123"
    }
} satisfies ConfigType as ConfigType;

export interface ConfigType {
    readonly host: string
    readonly port: number

    /**
     * HTTPS/SSL options. Not used if running locally or with nginx.
     */
    readonly ssl?: {
        readonly keyFile: string
        readonly certFile: string
        readonly caFile: string
    }

    readonly map: keyof typeof MapDefs

    /**
     * There are 5 spawn modes: Random, Radius, Fixed, and Center.
     * SpawnMode.Random spawns the player at a random location.
     * SpawnMode.Fixed always spawns the player at the exact position given.
     * SpawnMode.Center always spawns the player in the center of the map.
     */
    readonly spawn: {
        readonly mode: SpawnMode.Random
    } | {
        readonly mode: SpawnMode.Fixed
        readonly pos: Vec2
    } | {
        readonly mode: SpawnMode.Center
    }

    /**
     * The maximum number of concurrent games.
     */
    readonly maxGames: number

    /**
     * Server tick rate
     */
    readonly tps: number
    /**
     * Join Time
     */
    readonly joinTime:number
    /**
     * Country Region
     */
    readonly country:string,
    readonly security?:{
        readonly antiddos?:{
            readonly window_limit_window:number
            readonly limit_request:number
        }
        //Reload If After Internal Error
        readonly autoReload?:boolean
        //Security Key
        readonly adminCryptKey?:string
        //Password To Terminal
        readonly terminalPassword?:string
    }

}
