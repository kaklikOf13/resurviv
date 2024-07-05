import { util } from "../../../utils/util";
import { type MapDef } from "../../mapDefs";
import { TinyMain } from "../tinyMainDefs";

export const MonsterHunter: MapDef = util.mergeDeep(util.cloneDeep(TinyMain),{
    mapId: 16,
    desc: { name: "MonsterHunter", icon: "img/gui/player-the-hunted.svg", buttonCss: "red-play-button-style",buttonText:"monster-hunter" },
    gameMode: {
        maxPlayers: 15,
        joinTime:120,
        teamsMode:true,
        plugins:[
            {
                "id":"give_items_after_run",
                params:[{chest:"chest04",helmet:"helmet04_last_man_red",backpack:"backpack03"},{
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
                },{maxHealth:150,health:150,boost:100,scale:1.4},{
                    slot1:"m870",
                    slot2:"awc"
                }],
                values:{
                    separate:2,
                },
            },
            {
                id:"better_start",
                values:{
                    "min":2,
                    "after":30
                }
            },
            {
                id:"everyone_in_same_team"
            }
        ],
    },
});