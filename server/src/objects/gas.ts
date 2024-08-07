import { type Vec2, v2 } from "./../../../shared/utils/v2";
import { GameConfig } from "../../../shared/gameConfig";
import { math } from "../../../shared/utils/math";
import { util } from "../../../shared/utils/util";
import { Game } from "../game";
export interface GasDef{
    readonly initWaitTime: number,
    readonly waitTimeDecay: number,
    readonly waitTimeMin: number,
    readonly initGasTime: number,
    readonly gasTimeDecay: number,
    readonly gasTimeMin: number,
    readonly initWidth: number,
    readonly widthDecay: number,
    readonly widthMin: number,
    readonly damageTickRate: number,
    readonly damage: number[]
}
const GasMode = GameConfig.GasMode;
export class Gas {
    /**
     * Current gas mode
     * 0: Inactive: The gas is not active, used when only a single player is on the lobby
     * 1: Waiting: The Gas has started and is waiting to advance to the next stage
     * 2: Moving: The gas is moving between one stage and another
     */
    mode: number = GasMode.Inactive;

    /**
     * Current gas stage used to track the gas damage from `GameConfig.gas.damage`
     * Is incremented when gas mode changes
     */
    stage = 0;

    idx=0;

    /**
     * Current gas stage damage
     */
    damage = 0;

    /**
     * Gets current gas duration
     * returns 0 if gas if inactive
     * time the gas needs if gas is moving
     * or time the gas needs to wait to trigger the next stage
     */
    get duration() {
        if (this.mode === GasMode.Inactive) return 0;
        if (this.mode === GasMode.Moving) return this.gasTime;
        return this.waitTime;
    }

    /**
     * Gas wait time
     * This is the time to wait when on waiting mode
     */
    waitTime: number;
    /**
     * Gas Time
     * This is the time for the gas to move between one stage to another
     * When on moving mode
     */
    gasTime: number;

    /**
     * Old gas radius
     * When gas mode is waiting this will be the same as `currentRad`
     * When gas mode is moving this will be the radius from the previous state
     * And will be used for lerping `currentRad`
     */
    radOld: number;
    /**
     * New gas radius
     * When gas mode is waiting this will be the radius for the new stage
     * When gas mode is moving this will be the radius at the end of the stage
     */
    radNew: number;
    /**
     * Current gas radius
     * When gas mode is waiting this and `radOld` will be the same
     * When gas mode is moving this will be a lerp between `radOld` and `radNew` using `gasT` as the interpolation factor
     */
    currentRad: number;

    /**
     * Old gas position
     * When gas mode is waiting this will be the same as `currentPos`
     * When gas mode is moving this will be the position from the previous state
     * And will be used for lerping `currentPos`
     */
    posOld: Vec2;
    /**
     * New gas position
     * When gas mode is waiting this will be the position for the new stage
     * When gas mode is moving this will be the position at the end of the stage
     */
    posNew: Vec2;
    /**
     * Current gas position
     * When gas mode is waiting this and `posOld` will be the same
     * When gas mode is moving this will be a lerp between `posOld` and `posNew` using `gasT` as the interpolation factor
     */
    currentPos: Vec2;

    /**
     * Gas Timer
     * in a range between 0 and 1
     */
    gasT = 0;

    /**
     * Current duration ticker
     */
    private _gasTicker = 0;

    /**
     * If the gas full state needs to be sent to clients
     */
    dirty = true;
    /**
     * If the gas time needs to be sent to clients
     */
    timeDirty = true;

    private _damageTicker = 0;

    doDamage = false;
    gasC:GasDef
    constructor(
        readonly map: Vec2,readonly game:Game
    ) {
        const mapSize = (map.x + map.y) / 2;
        this.gasC=this.game.map.mapDef.gameConfig.gas??GameConfig.gas
        this.radNew = this.radOld = this.currentRad = this.gasC.initWidth * mapSize;

        this.posOld = v2.create(
            map.x / 2,
            map.y / 2
        );

        this.posNew = v2.copy(this.posOld);
        this.currentPos = v2.copy(this.posOld);
        this.waitTime=this.gasC.initWaitTime
        this.gasTime=this.gasC.initGasTime
    }

    update(dt: number) {
        if (this.gasT >= 1) {
            this.advanceGasStage();
        }

        this._gasTicker += dt;

        if (this.mode != GasMode.Inactive) {
            this.gasT = math.clamp(this._gasTicker / this.duration, 0, 1);
            this.timeDirty = true;
        }

        this.doDamage = false;
        this._damageTicker += dt;

        if (this._damageTicker >= this.gasC.damageTickRate) {
            this._damageTicker = 0;
            this.doDamage = true;
        }

        if (this.mode === GasMode.Moving) {
            this.currentPos = v2.lerp(this.gasT, this.posOld, this.posNew);
            this.currentRad = math.lerp(this.gasT, this.radOld, this.radNew);
        }
    }

    advanceGasStage() {
        if (this.currentRad <= 0) {
            return;
        }
        this.idx++
        if (this.mode !== GasMode.Waiting) {
            this.radOld = this.currentRad;

            if (this.radNew > 0) {
                this.radNew = this.currentRad * this.gasC.widthDecay;

                if (this.radNew < this.gasC.widthMin) {
                    this.radNew = 0;
                }

                this.posOld = v2.copy(this.posNew);

                this.posNew = v2.add(this.posOld, util.randomPointInCircle(this.radNew));

                const rad = this.radNew;
                this.posNew = math.v2Clamp(this.posNew,
                    v2.create(rad, rad),
                    v2.create(this.map.x - rad, this.map.y - rad)
                );
            }

            this.currentRad = this.radOld;
            this.currentPos = this.posOld;
        }

        switch (this.mode) {
        case GasMode.Inactive: {
            this.mode = GasMode.Waiting;
            break;
        }
        case GasMode.Waiting: {
            this.mode = GasMode.Moving;
            this.gasTime = math.max(this.gasTime - this.gasC.gasTimeDecay, this.gasC.gasTimeMin);
            if (this.radNew > 0) {
                this.stage++;
            }
            break;
        }
        case GasMode.Moving: {
            this.waitTime = math.max(this.waitTime - this.gasC.waitTimeDecay, this.gasC.waitTimeMin);
            this.mode = GasMode.Waiting;
            if (this.radNew > 0) {
                this.stage++;
            }
            break;
        }
        }
        for(const p of this.game.map.mapDef.gameConfig.planes.timings){
            if(p.circleIdx! as number==this.idx){
                this.game.airdropBarn.addPlane(undefined,p.wait)
            }
        }

        this.damage = this.gasC.damage[math.clamp(this.stage - 1, 0, this.gasC.damage.length - 1)];
        this._gasTicker = 0;
        this.dirty = true;
        this.timeDirty = true;
    }

    isInGas(pos: Vec2) {
        return v2.distance(pos, this.currentPos) >= this.currentRad;
    }

    flush() {
        this.dirty = false;
        this.timeDirty = false;
    }
}
