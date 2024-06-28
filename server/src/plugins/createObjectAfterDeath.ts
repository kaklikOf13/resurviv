import { EventType, GamePlugin } from "../utils/plugins"
export class CreateObjectAfterDeathPlugin extends GamePlugin{
    object:string
    constructor(object:string){
        super()
        this.object=object
    }
    initSignals(): void {
        this.on(EventType.PlayerDie,(e)=>{
            e.player.game.map.genAuto(this.object,e.player.pos,e.player.layer)
        })
    }
}