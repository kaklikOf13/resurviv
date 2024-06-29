import { HealingAfterKillPlugin } from "../../../server/src/plugins/healingAfterKill";
import { util } from "../../utils/util";
import { type MapDef } from "../mapDefs";
import { TinyMain } from "./tinyMainDefs";

export const Deathmatch: MapDef = util.mergeDeep(TinyMain,{
    mapId: 16,
    desc: { name: "Deathmatch", icon: "", buttonCss: "" },
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
                10, 10, 20, 25,20,20
            ]
        },
        lootDespawn:20
    },
    mapGen: {
        map: {
            baseWidth: 180,
            baseHeight: 180,
            scale: { small: 1, large: 1.2 },
            extension: 100,
            shoreInset: 48,
            grassInset: 12,
            rivers:null,
        },
        densitySpawns: [
            {
                stone_01: {max:20,min:15},
                barrel_01: {max:20,min:10},
                silo_01: {max:2,min:1},
                crate_01: {max:11,min:6},
                crate_02: 3,
                crate_03: {max:5,min:2},
                bush_01: 5,
                cache_06: 6,
                tree_01: {max:25,min:15},
                hedgehog_01: 2,
                shack_01: 1,
                loot_tier_1: {max:10,min:5},
                loot_tier_beach: 5,
            },
        ],
    }
});