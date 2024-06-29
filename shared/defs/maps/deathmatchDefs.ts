import { HealingAfterKillPlugin } from "../../../server/src/plugins/healingAfterKill";
import { util } from "../../utils/util";
import { type MapDef } from "../mapDefs";
import { TinyMain } from "./tinyMainDefs";

export const Deathmatch: MapDef = util.mergeDeep({
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
                10, 10, 10, 20,20,20
            ]
        },
        lootDespawn:10
    },
},TinyMain);
