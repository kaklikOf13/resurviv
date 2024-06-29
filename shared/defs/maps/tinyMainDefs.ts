import { util } from "../../utils/util";
import { v2 } from "../../utils/v2";
import { type MapDef } from "../mapDefs";
import { Main } from "./baseDefs";

// @NOTE: Entries defined as single-element arrays, like fixedSpawns: [{ }],
// are done this way so that util.mergeDeep(...) will function as expected
// when used by derivative maps.
//
// Arrays are not mergeable, so the derived map will always redefine all
// elements if that property is set.

export const TinyMain: MapDef = {
    mapId: 17,
    desc: { name: "BattleRoyale", icon: "", buttonCss: "" },
    assets: Main.assets,
    biome: Main.biome,
    gameMode: {
        maxPlayers: 20,
        killLeaderEnabled: true,
    },
    gameConfig: Main.gameConfig,
    lootTable:Main.lootTable,
    mapGen: {
        map: {
            baseWidth: 300,
            baseHeight: 300,
            scale: { small: 1, large: 1.2 },
            extension: 130,
            shoreInset: 48,
            grassInset: 12,
            rivers: {
                lakes: [],
                weights: [
                    { weight: 0.25, widths: [4] },
                    { weight: 0.3, widths: [4, 2] },
                    { weight: 0.1, widths: [5,2] },
                ],
                smoothness: 0.55,
                masks: []
            }
        },
        places: Main.mapGen.places,
        bridgeTypes: Main.mapGen.bridgeTypes,
        customSpawnRules: {
            locationSpawns: [
                {
                    type: "club_complex_01",
                    pos: v2.create(0.5, 0.5),
                    rad: 50,
                    retryOnFailure: true
                }
            ],
            placeSpawns: [
            ]
        },
        densitySpawns: [
            {
                stone_01: {max:60,min:35},
                barrel_01: {max:30,min:20},
                silo_01: {max:3,min:1},
                crate_01: {max:40,min:30},
                crate_02: 5,
                crate_03: {max:10,min:5},
                bush_01: 30,
                cache_06: 10,
                tree_01: {max:75,min:60},
                hedgehog_01: 2,
                shack_01: 1,
                loot_tier_1: {max:10,min:5},
                loot_tier_beach: 5,
                chest_01:1,
                chest_02:1,
                stone_04:1
            },
        ],
        fixedSpawns: [
            
        ],
        randomSpawns: [
            {
                spawns: [
                    "mansion_structure_01",
                    "club_complex_01",
                    "police_01",
                    "greenhouse_01",
                    "bank_01",
                    "warehouse_complex_01",
                ],
                choose: 5
            },
            {
                spawns:[
                    "warehouse_01",
                    "house_red_01",
                    "house_red_02",
                    "barn_01",
                    "barn_02"
                ],
                choose:{min:2,max:5},
                repeat:true
            },
            {
                spawns:[
                    "container_01",
                    "container_02",
                    "container_03",
                    "container_04",
                    "container_05",
                    {value:"container_06",chance:.3}
                ],
                choose:{min:6,max:10},
                repeat:true
            },
        ],
        spawnReplacements: [{}],
        importantSpawns: []
    }
};
