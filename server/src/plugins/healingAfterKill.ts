import { ObjectType } from "../../../shared/utils/objectSerializeFns"
import { EventType, GamePlugin } from "../utils/plugins"
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