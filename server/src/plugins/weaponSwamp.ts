import { GunDefs } from "../../../shared/defs/gameObjects/gunDefs"
import { ObjectType } from "../../../shared/utils/objectSerializeFns"
import { util } from "../../../shared/utils/util"
import { Emote } from "../objects/player"
import { EventType, GamePlugin } from "../utils/plugins"
export class WeaponSwampPlugin extends GamePlugin{
    constructor(){
        super()
    }
    initSignals(): void {
        this.on(EventType.PlayerDie,(e)=>{
            if(e.killer.source&&e.killer.source.__type==ObjectType.Player){
                if(e.killer.source.curWeapIdx<=1){
                    const arr=Object.keys(GunDefs)
                    const wep=arr[util.randomInt(0,arr.length)]
                    e.killer.source.weaponManager.weapons[e.killer.source.curWeapIdx].type=wep  
                    //@ts-expect-error
                    e.killer.source.weaponManager.weapons[e.killer.source.curWeapIdx].ammo=GunDefs[wep].maxClip
                    this.game.playerBarn.emotes.push(new Emote(e.killer.source.__id,e.killer.source.pos,wep,false))
                    e.killer.source.weapsDirty=true
                    e.killer.source.setDirty()
                }
            }
        })
    }
}