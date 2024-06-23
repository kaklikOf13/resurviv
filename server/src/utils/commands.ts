import { Vec2, v2 } from "../../../shared/utils/v2";
import { Game } from "../game";
import { GameObject } from "../objects/gameObject";
import { Obstacle } from "../objects/obstacle";
import { Player } from "../objects/player";

function argsplit(str:string) {
    const re = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;
    const args = [];
    let match;

    while ((match = re.exec(str)) !== null) {
        let arg = match[0];
        if (arg[0] === '"' && arg[arg.length - 1] === '"') {
            arg = arg.slice(1, -1);
        } else if (arg[0] === "'" && arg[arg.length - 1] === "'") {
            arg = arg.slice(1, -1);
        }
        args.push(arg);
    }

    return args;
}
export class GameTerminal{
    game:Game
    constructor(game:Game){
        this.game=game
    }
    parseTarget(target:string="@a",pos:Vec2):Array<Player|Obstacle>{
        switch(target){
            case "@a":
                return [...this.game.playerBarn.livingPlayers,...this.game.map.obstacles]
            default:
                const ret:Array<Player|Obstacle>=[]
                for(const p of this.game.playerBarn.livingPlayers){
                    if(p.name==target){
                        ret.push(p)
                    }
                }
                return ret
        }
    }
    kill(target:string,pos:Vec2){
        for(const s of this.parseTarget(target,pos)){
            s.kill({
                amount:99999,
                damageType:0,
                dir:s.pos,
            })
        }
    }
    execute(command:string){
        const args=argsplit(command)
        switch(args[0]){
            case "kill":
                this.kill(args[1],v2.create(0,0))
                break
            case "gas":
                switch(args[1]??"help"){
                    case "advance":
                        this.game.gas.advanceGasStage()
                        break
                    default:
                        console.log(`- gas\n\tadvance - advance gas stage\n`)
                        break
                }
                break
            default:
                console.log(`"commands:\nkill {target} - kill a player or obstacle\ngas {GasAction} - actions of gas`)
        }
    }
}