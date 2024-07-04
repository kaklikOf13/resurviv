import { util } from "../../utils/util";
import { type MapDef } from "../mapDefs";
import { TinyMain } from "./tinyMainDefs";

export const Deathmatch: MapDef = util.mergeDeep(util.cloneDeep(TinyMain),{
    mapId: 16,
    desc: { name: "deathmatch", icon: "img/gui/loadout-pump.svg", buttonCss: "",buttonText:"deathmatch" },
    gameMode: {
        maxPlayers: 10,
        killLeaderEnabled: true,
        selectableGuns:true,
        joinTime:250,
        plugins:[
            {
                "id":"healing_after_kill",
                params:[30]
            }
        ],
        spawnInventory:{
            "2xscope": 1,
            "4xscope": 1,

            "9mm":420,
            "762mm": 300,
            "556mm": 300,
            "12gauge": 90,
            "50AE": 196,
            "308sub": 80,
            "45acp": 300,

            "bandage": 30,
            "healthkit": 4,
            "soda": 15,
            "painkiller": 4,

            "frag":3,
            "mirv":1,
            "smoke":2
        },
        spawnEquips:{
            "backpack":"backpack03",
            "chest":"chest03",
            "helmet":"helmet03"
        },
        spawnStatus:{
            boost:100,
        },
    },
    gameConfig: {
        planes: {
            timings: [
            ],
            crates: [
            ]
        },
        bagSizes: {},
        bleedDamage: 1,
        bleedDamageMult: 1,
        gas:{
            initWaitTime: 220,
            waitTimeDecay: 220,
            waitTimeMin: 30,
            initGasTime: 25,
            gasTimeDecay: 5,
            gasTimeMin: 5,
            initWidth: 0.75,
            widthDecay: .6,
            widthMin: 25,
            damageTickRate: 2,
            damage: [
                25,25,30,40,45,50
            ]
        },
        lootDespawn:15
    },
    mapGen: {
        map: {
            baseWidth: 250,
            baseHeight: 250,
            scale: { small: 1, large: 1.2 },
            extension: 30,
            shoreInset: 48,
            grassInset: 12,
            rivers:null,
        },
        densitySpawns: [
            {
                stone_01: {max:20,min:15},
                barrel_01: {max:20,min:10},
                silo_01: {max:2,min:1},
                crate_01: {max:6,min:4},
                crate_02: 3,
                crate_03: {max:5,min:2},
                bush_01: 5,
                cache_06: 3,
                tree_01: {max:20,min:15},
                hedgehog_01: 2,
                shack_01: 1,
                loot_tier_1: {max:7,min:5},
                loot_tier_beach: 5,
                tree_02:{max:4,min:1},
            },
        ],
    }
});