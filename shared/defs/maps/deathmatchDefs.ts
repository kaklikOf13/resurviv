import { HealingAfterKillPlugin } from "../../../server/src/plugins/healingAfterKill";
import { v2 } from "../../utils/v2";
import { type MapDef } from "../mapDefs";
import { Main } from "./baseDefs";

// @NOTE: Entries defined as single-element arrays, like fixedSpawns: [{ }],
// are done this way so that util.mergeDeep(...) will function as expected
// when used by derivative maps.
//
// Arrays are not mergeable, so the derived map will always redefine all
// elements if that property is set.

export const Deathmatch: MapDef = {
    mapId: 12,
    desc: { name: "Deathmatch", icon: "", buttonCss: "" },
    assets: {
        audio: [
            { name: "club_music_01", channel: "ambient" },
            { name: "club_music_02", channel: "ambient" },
            { name: "ambient_steam_01", channel: "ambient" },
            { name: "log_11", channel: "sfx" },
            { name: "log_12", channel: "sfx" }
        ],
        atlases: ["gradient", "loadout", "shared", "main"]
    },
    biome: {
        colors: {
            background: 2118510,
            water: 3310251,
            waterRipple: 11792639,
            beach: 13480795,
            riverbank: 9461284,
            grass: 8433481,
            underground: 1772803,
            playerSubmerge: 2854052,
            playerGhillie: 8630096
        },
        valueAdjust: 1,
        sound: { riverShore: "sand" },
        particles: { camera: "" },
        tracerColors: {},
        airdrop: {
            planeImg: "map-plane-01.img",
            planeSound: "plane_01",
            airdropImg: "map-chute-01.img"
        }
    },
    gameMode: {
        maxPlayers: 15,
        killLeaderEnabled: true,
        selectableGuns:true,
        joinTime:250,
        plugins:[
            new HealingAfterKillPlugin(30)
        ],
        spawnInventory:{
            "2xscope": 1,
            "4xscope": 1,

            "9mm":420,
            "762mm": 300,
            "556mm": 300,
            "12gauge": 90,
            "50AE": 196,
            "308sub": 45,
            "45acp": 300,

            "bandage": 30,
            "healthkit": 4,
            "soda": 15,
            "painkiller": 4,
        },
        spawnEquips:{
            "backpack":"backpack03",
            "chest":"chest03",
            "helmet":"helmet03"
        },
        spawnStatus:{
            boost:100,
        }
    },
    gameConfig: {
        planes: {
            timings: [
            ],
            crates: [
            ]
        },
        bagSizes: {},
        bleedDamage: 2,
        bleedDamageMult: 1,
        gas:{
            initWaitTime: 240,
            waitTimeDecay: 240,
            waitTimeMin: 30,
            initGasTime: 30,
            gasTimeDecay: 20,
            gasTimeMin: 20,
            initWidth: 0.75,
            widthDecay: .4,
            widthMin: 60,
            damageTickRate: 2,
            damage: [
                10, 10, 10, 20,20,20
            ]
        },
        lootDespawn:10
    },
    lootTable:Main.lootTable,
    mapGen: {
        map: {
            baseWidth: 230,
            baseHeight: 230,
            scale: { small: 1.2, large: 1.4 },
            extension: 112,
            shoreInset: 48,
            grassInset: 18,
        },
        places: [
            {
                name: "The Killpit",
                pos: v2.create(0.53, 0.64)
            },
            {
                name: "Sweatbath",
                pos: v2.create(0.84, 0.18)
            },
            {
                name: "Tarkhany",
                pos: v2.create(0.15, 0.11)
            },
            {
                name: "Ytyk-Kyuyol",
                pos: v2.create(0.25, 0.42)
            },
            {
                name: "Todesfelde",
                pos: v2.create(0.81, 0.85)
            },
            {
                name: "Pineapple",
                pos: v2.create(0.21, 0.79)
            },
            {
                name: "Fowl Forest",
                pos: v2.create(0.73, 0.47)
            },
            {
                name: "Ranchito Pollo",
                pos: v2.create(0.53, 0.25)
            }
        ],
        bridgeTypes: {
            medium: "",
            large: "",
            xlarge: ""
        },
        customSpawnRules: {
            locationSpawns: [
                {
                    type: "club_complex_01",
                    pos: v2.create(0.5, 0.5),
                    rad: 10,
                    retryOnFailure: true
                }
            ],
            placeSpawns: [
                "warehouse_01",
                "house_red_01",
                "house_red_02",
                "barn_01"
            ]
        },
        densitySpawns: [
            {
                stone_01: {max:30,min:25},
                barrel_01: {max:20,min:10},
                silo_01: {max:2,min:1},
                crate_01: {max:30,min:25},
                crate_02: 3,
                crate_03: 6,
                bush_01: 20,
                cache_06: 3,
                tree_01: {max:33,min:25},
                hedgehog_01: 2,
                shack_01: 1,
                loot_tier_1: {max:10,min:5},
                loot_tier_beach: 2
            }
        ],
        fixedSpawns: [
            {
                house_red_01: { small: 1, large: 1 },
                house_red_02: { small: 1, large: 1 },
                barn_01: { small: 0, large: 1 },
                hut_01: 0,
                hut_02: 0,
                shack_03a: 0,
                shack_03b: { small: 2, large: 3 },
                cache_01: 1,
                cache_02: 1,
                cache_07: 1,
                bunker_structure_01: 1,
                bunker_structure_03: 1,
                chest_01: 2,
                mil_crate_02: { odds: 0.25 },
                tree_02: 3,
                stone_04: 1,
            }
        ],
        randomSpawns: [
            {
                spawns: [
                    "mansion_structure_01",
                    "club_complex_01",
                    "police_01",
                    "greenhouse_01",
                    "bank_01",
                    "warehouse_complex_01"
                ],
                choose: 3
            },
            {
                spawns:[
                    "container_01",
                    "container_02",
                    "container_03",
                    "container_04",
                    "container_05",
                    "container_06"
                ],
                choose:{min:3,max:5},
                repeat:true
            },
        ],
        spawnReplacements: [{}],
        importantSpawns: []
    }
};
