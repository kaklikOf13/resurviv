import { type Game } from "../game";
import { collider } from "../../../shared/utils/collider";
import { v2, type Vec2 } from "../../../shared/utils/v2";
import { BaseGameObject } from "./gameObject";
import { ObjectType } from "../../../shared/utils/objectSerializeFns";
import { Emote } from "./player";
import { GameConfig } from "../../../shared/gameConfig";
import { AABB, coldet } from "../../../shared/utils/coldet";
import { util } from "../../../shared/utils/util";

export class AirdropBarn {
    airdrops: Airdrop[] = [];
    addAirdrop(pos:Vec2){
        const ad=new Airdrop(this.game,pos)
        this.game.objectRegister.register(ad);
        this.airdrops.push(ad)
    }
    addPlane(pos:Vec2=this.game.map.getRandomSpawnPos(),delay:number=5){
        setTimeout(()=>{this.addAirdrop(pos)},delay*1000)
    }
    update(dt: number) {
        for (let i = 0; i < this.airdrops.length; i++) {
            const ad = this.airdrops[i];
            if (ad.destroyed) {
                this.airdrops.splice(i, 0);
                continue;
            }
            ad.update(dt);
        }
    }
    constructor(readonly game: Game) {}
}

export class Airdrop extends BaseGameObject {
    bounds = collider.createAabbExtents(v2.create(0, 0), v2.create(5, 5));

    override readonly __type = ObjectType.Airdrop;

    layer = 0;

    fallT = 1;
    landed = false;
    fallD:number

    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(game: Game, pos: Vec2) {
        super(game, pos);
        this.fallT=1
        this.game.playerBarn.emotes.push(new Emote(
            0,
            this.pos,
            "ping_airdrop",
            true
        ))
        this.fallD=(1/game.config.tps)/GameConfig.airdrop.fallTime
    }
    update(_dt:number){
        if(this.landed){
            this.destroy()
        }else{
            if(this.fallT<=0){
                this.fallT=0
                this.fall()
            }else{
                this.fallT-=this.fallD
            }
        }
    }
    fall(){
        const airdrop=Math.random()<=.2?(this.game.map.mapDef.gameConfig.airdrop?this.game.map.mapDef.gameConfig.airdrop.common:"crate_11"):(this.game.map.mapDef.gameConfig.airdrop?this.game.map.mapDef.gameConfig.airdrop.rare:"crate_10")
        const ar=this.game.map.genObstacle(airdrop,this.pos,this.layer)
        for (const object of [...this.game.grid.intersectCollider(ar.collider)]) {
            if(!util.sameLayer(ar.layer,object.layer)){continue}
            if ((object as { dead?: boolean }).dead) continue;
            switch (object.__type) {
                case ObjectType.Player:
                    if (coldet.test(ar.collider,object.collider)) {
                        object.damage({amount:GameConfig.airdrop.crushDamage,damageType:GameConfig.DamageType.Airdrop,dir:v2.create(0,0)});
                    }
                    break
                case ObjectType.Player,ObjectType.Obstacle: {
                    if (object !== ar && coldet.test(ar.collider,object.collider)) {
                        object.damage({amount:GameConfig.airdrop.crushDamage,damageType:GameConfig.DamageType.Airdrop,dir:v2.create(0,0)});
                    }
                    break;
                }
            }
        }
        this.landed=true
        this.setPartDirty()
    }
}
