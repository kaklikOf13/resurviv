import { GunDefs } from "../../../shared/defs/gameObjects/gunDefs"
import { ObjectType } from "../../../shared/utils/objectSerializeFns"
import { util } from "../../../shared/utils/util"
import { Team } from "../objects/player"
import { EventType, GamePlugin } from "../utils/plugins"
export class CreateObjectAfterDeathPlugin extends GamePlugin{
    object:string
    constructor(object:string=""){
        super()
        this.object=object
    }
    initSignals(): void {
        this.on(EventType.PlayerDie,(e)=>{
            e.player.game.map.genAuto(this.object,e.player.pos,e.player.layer)
        })
    }
}
export class HealingAfterKillPlugin extends GamePlugin{
    healingAmount:number
    constructor(healingAmount:number=20){
        super()
        this.healingAmount=healingAmount
    }
    initSignals(): void {
        this.on(EventType.PlayerDie,(e)=>{
            if(e.killer.source&&e.killer.source.__type==ObjectType.Player){
                e.killer.source.health+=this.healingAmount
            }
        })
    }
}
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
                    e.killer.source.weapsDirty=true
                    e.killer.source.setDirty()
                }
            }
        })
    }
}
export class GiveItensAfterRunPlugin extends GamePlugin{
    equips:Record<string,string>
    items:Record<string,number>
    weapons:{slot1:string,slot2:string}={slot1:"",slot2:""}
    status:Record<string,any>
    separate:number|undefined
    constructor(equips:Record<string,string>,items:Record<string,number>,status:Record<string,any>,weapons:{slot1:string,slot2:string}){
        super()
        this.equips=equips
        this.items=items
        this.status=status
        this.weapons=weapons
    }
    initSignals(): void {
        this.on(EventType.GameStart,(e)=>{this.apply()})
    }
    apply(){
        const p=this.game.playerBarn.randomPlayer()
        if(!p){
            return
        }
        p.game.playerBarn.playerInfoDirty.push(p)
        p.dropAllItens(1)
        p.giveItems(this.equips,this.items)
        p.giveGuns(this.weapons.slot1 as keyof typeof GunDefs,this.weapons.slot2 as keyof typeof GunDefs,true)
        if(this.separate){
            if(p.team){
                p.team.removePlayer(p)
            }
            if(this.game.playerBarn.teams[this.separate]){
                this.game.playerBarn.teams[this.separate]!.addPlayer(p)
            }else{
                const team=this.game.playerBarn.newTeam()
                team.addPlayer(p)
            }
        }
        for(const i in this.status){
            //@ts-expect-error
            p[i]=this.status[i]
        }
        p.setDirty()
    }
}
export class BetterStart extends GamePlugin{
    after:number=10
    min:number=2
    started:boolean=false
    constructor(){
        super()
    }
    initSignals(): void {
        this.on(EventType.PlayerJoin,(p)=>{
            if(!this.started&&p.game.playerBarn.livingPlayers.length>=this.min){
                this.started=true
                setTimeout(this.game.start.bind(this.game),this.after*1000)
            }
        })
    }
}
export class EveroneInSameTeamPlugin extends GamePlugin{
    equips:Record<string,string>
    items:Record<string,number>
    status:Record<string,any>
    constructor(equips:Record<string,string>,items:Record<string,number>,status:Record<string,any>){
        super()
        this.equips=equips
        this.items=items
        this.status=status
    }
    initSignals(): void {
        this.on(EventType.PlayerJoin,(e)=>{
            if(e.team){
                e.team.removePlayer(e)
            }
            if(e.game.playerBarn.teams[1]){
                e.game.playerBarn.teams[1]!.addPlayer(e)
            }else{
                const team=e.game.playerBarn.newTeam()
                team.addPlayer(e)
            }
        })
    }
}