import { type Game } from "../game";
import { collider } from "../../../shared/utils/collider";
import { v2, type Vec2 } from "../../../shared/utils/v2";
import { BaseGameObject } from "./gameObject";
import { ObjectType } from "../../../shared/utils/objectSerializeFns";
import { Emote } from "./player";
import { GameConfig } from "../../../shared/gameConfig";
import { coldet } from "../../../shared/utils/coldet";

export class AirdropBarn {
    airdrops: Airdrop[] = [];
    addAirdrop(pos:Vec2){
        const ad=new Airdrop(this.game,pos)
        this.game.objectRegister.register(ad);
        this.airdrops.push(ad)
    }
    addPlane(pos:Vec2=this.game.map.getRandomSpawnPos()){
        this.addAirdrop(pos)
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

    fallT = 0;
    landed = false;
    emoted=true

    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(game: Game, pos: Vec2) {
        super(game, pos);
        this.fallT=0
    }
    update(dt:number){
        if(this.emoted&&this.fallT>=0.5){
            this.game.playerBarn.emotes.push(new Emote(
                0,
                this.pos,
                "ping_airdrop",
                true
            ))
            this.emoted=false
        }
        if(this.fallT>=GameConfig.airdrop.fallTime){
            this.fall()
        }else{
            this.fallT+=dt
        }
    }
    fall(){
        const airdrop=Math.random()<=.2?(this.game.map.mapDef.gameConfig.airdrop?this.game.map.mapDef.gameConfig.airdrop.common:"crate_11"):(this.game.map.mapDef.gameConfig.airdrop?this.game.map.mapDef.gameConfig.airdrop.rare:"crate_10")
        const obs=this.game.map.genObstacle(airdrop,this.pos,this.layer)
        /*for (const object of this.game.grid.intersectCollider(obs.collider)) {
            switch (object.__type) {
                case ObjectType.Player,ObjectType.Obstacle: {
                    if (object !== obs && coldet.test(obs.collider, object.collider)) {
                        object.damage({amount:GameConfig.airdrop.crushDamage,damageType:GameConfig.DamageType.Airdrop,dir:obs.pos,source:obs});
                        break;
                    }
                }
            }
        }*/
        this.destroy()
        this.landed=true
    }
}
