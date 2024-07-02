import { type Vec2 } from "../utils/v2";
import { Cobalt } from "./maps/cobaltDefs";
import { Desert } from "./maps/desertDefs";
import { Faction } from "./maps/factionDefs";
import { Halloween } from "./maps/halloweenDefs";
import { Main } from "./maps/baseDefs";
import { MainSpring } from "./maps/mainSpringDefs";
import { MainSummer } from "./maps/mainSummerDefs";
import { Deathmatch } from "./maps/deathmatchDefs";
import { TinyMain } from "./maps/tinyMainDefs";
import { Potato } from "./maps/potatoDefs";
import { PotatoSpring } from "./maps/potatoSpringDefs";
import { Savannah } from "./maps/savannahDefs";
import { Snow } from "./maps/snowDefs";
import { Turkey } from "./maps/turkeyDefs";
import { Woods } from "./maps/woodsDefs";
import { WoodsSnow } from "./maps/woodsSnowDefs";
import { WoodsSpring } from "./maps/woodsSpringDefs";
import { WoodsSummer } from "./maps/woodsSummerDefs";
import { GasDef } from "../../server/src/objects/gas";
import { RandomVal } from "../utils/util";
import { type GamePlugin } from "../../server/src/utils/plugins";
import { PluginInstance } from "../../server/src/data/pluginsDefs";
export const MapDefs = {
    main: Main,
    main_spring: MainSpring,
    main_summer: MainSummer,
    tinymain: TinyMain,
    deathmatch:Deathmatch,
    desert: Desert,
    faction: Faction,
    halloween: Halloween,
    potato: Potato,
    potato_spring: PotatoSpring,
    snow: Snow,
    woods: Woods,
    woods_snow: WoodsSnow,
    woods_spring: WoodsSpring,
    woods_summer: WoodsSummer,
    savannah: Savannah,
    cobalt: Cobalt,
    turkey: Turkey
};
export interface MapDef {
    mapId: number
    desc: {
        name: string
        icon: string
        buttonCss: string
    }
    assets: {
        audio: Array<{
            name: string
            channel: string
        }>
        atlases: string[]
    }
    biome: {
        colors: {
            background: number
            water: number
            waterRipple: number
            beach: number
            riverbank: number
            grass: number
            underground: number
            playerSubmerge: number
            playerGhillie: number
        }
        valueAdjust: number
        sound: {
            riverShore: string
        }
        particles: {
            camera: string
        }
        tracerColors: Record<string, number>
        airdrop: {
            planeImg: string
            planeSound: string
            airdropImg: string
        }
    }

    gameMode: {
        maxPlayers: number
        joinTime?:number
        killLeaderEnabled: boolean
        woodsMode?: boolean
        desertMode?: boolean
        potatoMode?: boolean
        sniperMode?: boolean
        perkMode?: boolean
        perkModeRoles?: string[]
        factionMode?: boolean
        factions?: number
        selectableGuns?:boolean
        spawnInventory?:Record<string,number>
        spawnEquips?:Record<string,string>
        spawnStatus?:{
            health?:number,
            boost?:number
        },
        plugins?:PluginInstance[]
    }
    gameConfig: {
        planes: {
            timings: Array<
            {
                circleIdx: number
                wait: number
                options: { type: number }
            }>
        }
        airdrop?:{
            common:string,
            rare:string
        }
        bagSizes: Record<string, number>
        bleedDamage: number
        bleedDamageMult: number
        gas?:GasDef,
        lootDespawn?:number
    }
    lootTable: Record<string, Array<{
        name: string
        count: number
        weight: number
    }>>
    mapGen: {
        map: {
            baseWidth: number
            baseHeight: number
            scale: { small: number, large: number }
            extension: number
            shoreInset: number
            grassInset: number
            rivers?: {
                lakes: Array<{
                    odds: number
                    innerRad: number
                    outerRad: number
                    spawnBound: {
                        pos: Vec2
                        rad: number
                    }
                }>
                weights: Array<{ weight: number, widths: number[] }>
                smoothness: number
                masks: Array<{
                    pos: Vec2
                    rad: number
                }>
            }
        }
        places: Array<{ name: string, pos: Vec2 }>
        bridgeTypes: {
            medium: string
            large: string
            xlarge: string
        }
        customSpawnRules: {
            locationSpawns: Array<{
                type: string
                pos: Vec2
                rad: number
                retryOnFailure: boolean
            }>
            placeSpawns: string[]
        }
        densitySpawns: Array<Record<string, RandomVal>>
        fixedSpawns: Array<
        Record<string,
        number | { odds: number } | { small: number, large: number }
        >
        >
        randomSpawns: Array<{
            spawns: (string|{value:string,chance:number})[]
            choose: RandomVal
            repeat?:boolean
        }>
        spawnReplacements: Array<Record<string, string>>
        importantSpawns: string[]
    }
}
