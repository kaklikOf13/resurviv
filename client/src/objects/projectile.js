import * as PIXI from "pixi.js-legacy";
import { GameConfig } from "../../../shared/gameConfig";
import { collider } from "../../../shared/utils/collider";
import { math } from "../../../shared/utils/math";
import { util } from "../../../shared/utils/util";
import { v2 } from "../../../shared/utils/v2";
import { playHitFx } from "./bullet";
import { Pool } from "./objectPool";
import { GameObjectDefs } from "../../../shared/defs/gameObjectDefs";
import { MapObjectDefs } from "../../../shared/defs/mapObjectDefs";

class Projectile {
    constructor() {
        this.container = new PIXI.Container();
        this.container.visible = false;
        this.trail = PIXI.Sprite.from("player-bullet-trail-02.img");
        this.trail.anchor.set(1, 0.5);
        this.trail.scale.set(1, 1);
        this.trail.visible = false;
        this.container.addChild(this.trail);
        this.sprite = new PIXI.Sprite();
        this.sprite.anchor.set(0.5, 0.5);
        this.container.addChild(this.sprite);
        this.strobeSprite = null;
    }

    init() { }
    free() {
        this.container.visible = false;
        if (this.strobeSprite) {
            this.strobeSprite.visible = false;
        }
    }

    updateData(data, fullUpdate, isNew, a) {
        // Copy data
        if (fullUpdate) {
            const itemDef = GameObjectDefs[data.type];
            this.layer = data.layer;
            this.type = data.type;
            // Use a smaller visual radius for collision effects
            this.rad = itemDef.rad * 0.5;
        }

        this.posOld = isNew ? v2.copy(data.pos) : v2.copy(this.pos);
        this.posZOld = isNew ? data.posZ : this.posZ;
        this.pos = v2.copy(data.pos);
        this.posZ = data.posZ;
        this.dir = v2.copy(data.dir);

        if (isNew) {
            const itemDef = GameObjectDefs[data.type];
            const imgDef = itemDef.worldImg;
            this.imgScale = imgDef.scale;
            this.rot = 0;
            this.rotVel = itemDef.throwPhysics.spinVel;
            if (
                itemDef.throwPhysics.randomizeSpinDir &&
                Math.random() < 0.5
            ) {
                this.rotVel *= -1;
            }
            this.rotDrag = itemDef.throwPhysics.spinDrag * util.random(1, 2);
            this.velZ = 0;
            this.grounded = false;
            this.inWater = false;
            this.lastSoundObjId = 0;
            this.playHitSfx = !itemDef.explodeOnImpact;
            this.alwaysRenderOntop = false;
            let isVisible = true;

            // Airstrike-projectile related hacks
            if (this.type == "bomb_iron") {
                this.alwaysRenderOntop = true;

                const col = collider.createCircle(this.pos, 0.5);
                if (a.map.insideBuildingCeiling(col, true)) {
                    isVisible = false;
                }
            }

            // Setup sprite
            this.sprite.texture = PIXI.Texture.from(imgDef.sprite);
            this.sprite.tint = imgDef.tint;
            this.sprite.alpha = 1;

            this.container.visible = isVisible;

            // Strobe variables
            if (data.type == "strobe") {
                if (!this.strobeSprite) {
                    this.strobeSprite = new PIXI.Sprite();
                    this.strobeSprite.texture =
                        PIXI.Texture.from("part-strobe-01.img");
                    this.strobeSprite.anchor.set(0.5, 0.5);
                    this.container.addChild(this.strobeSprite);
                }
                this.strobeSprite.scale.set(0, 0);
                this.strobeSprite.visible = true;
                this.strobeScale = 0;
                this.strobeScaleMax = 12;
                this.strobeTicker = 0;
                this.strobeDir = 1;
                this.strobeSpeed = 1.25;
            }
        }
    }
}
const groundSounds = {
    grass: "frag_grass",
    sand: "frag_sand",
    water: "frag_water"
};

export class ProjectileBarn {
    constructor() {
        this.projectilePool = new Pool(Projectile);
    }

    /**
     * @param {number} dt
     * @param {import("./particles").ParticleBarn} inputBinds
     * @param {import("./audioManager").AudioManager} audioManager
     * @param {import("./player").Player} activePlayer
     * @param {import("../map").Map} map
     * @param {import("../renderer").Renderer} renderer
     * @param {import("../camera").Camera} camera
     */
    update(dt, particleBarn, audioManager, activePlayer, map, renderer, camera) {
        const projectiles = this.projectilePool.getPool();
        for (let i = 0; i < projectiles.length; i++) {
            const p = projectiles[i];
            if (p.active) {
                const itemDef = GameObjectDefs[p.type];
                let rotDrag = p.rotDrag;
                if (p.inWater) {
                    rotDrag *= 3;
                }
                p.rotVel *= 1 / (1 + dt * rotDrag);
                p.rot += p.rotVel * dt;

                // Detect overlapping obstacles for sound effects
                const wallCol = {
                    obj: null,
                    pen: 0
                };
                const groundCol = {
                    obj: null,
                    pen: 0
                };
                const projCollider = collider.createCircle(p.pos, p.rad);
                const obstacles = map.obstaclePool.getPool();
                for (let j = 0; j < obstacles.length; j++) {
                    const o = obstacles[j];
                    if (
                        o.active &&
                        !o.dead &&
                        util.sameLayer(o.layer, p.layer)
                    ) {
                        const res = collider.intersect(o.collider, projCollider);
                        if (res) {
                            const col = o.height > p.posZ ? wallCol : groundCol;
                            if (
                                res.pen > col.pen &&
                                (!col.obj || col.obj.height <= o.height)
                            ) {
                                col.obj = o;
                                col.pen = res.pen;
                            }
                        }
                    }
                }

                // Wall sound
                const vel = v2.div(v2.sub(p.pos, p.posOld), dt);
                const speed = v2.length(vel);
                if (
                    wallCol.obj &&
                    wallCol.obj.__id != p.lastSoundObjId &&
                    speed > 7.5 &&
                    ((p.lastSoundObjId = wallCol.obj.__id), p.playHitSfx)
                ) {
                    const dir = v2.mul(
                        v2.normalizeSafe(vel, v2.create(1, 0)),
                        -1
                    );
                    const mapDef = MapObjectDefs[wallCol.obj.type];
                    playHitFx(
                        mapDef.hitParticle,
                        mapDef.sound.bullet,
                        p.pos,
                        dir,
                        p.layer,
                        particleBarn,
                        audioManager
                    );
                }
                const surface = map.getGroundSurface(p.pos, p.layer);
                // Play an effect on initial ground contact

                if (p.posZ <= 0.01) {
                    if (!p.inWater && surface.type == "water") {
                        particleBarn.addRippleParticle(
                            p.pos,
                            p.layer,
                            surface.data.rippleColor
                        );
                    }
                    p.inWater = surface.type == "water";
                    p.rotVel*=.7
                }
                const velZOld = p.velZ;
                p.velZ = (p.posZ - p.posZOld) / dt;

                // Ground sound
                if (
                    !p.isNew &&
                    !p.grounded &&
                    p.velZ >= 0 &&
                    velZOld < 0
                ) {
                    // @HACK: there are two different functions for playing
                    // sounds, and we have to know which one to call for
                    // particular sound names. Same with the channel.
                    const sound = {
                        fn: "playGroup",
                        channel: "hits",
                        name: ""
                    };
                    if (groundCol.obj) {
                        if (p.lastSoundObjId != groundCol.obj.__id) {
                            p.lastSoundObjId = groundCol.obj.__id;
                            const def = MapObjectDefs[groundCol.obj.type];
                            sound.name = def.sound.bullet;
                        }
                    } else {
                        p.grounded = true;
                        sound.name = groundSounds[surface.type];
                        // @HACK: Attept to use a footstep sound if we failed
                        // finding a surface
                        if (sound.name === undefined) {
                            sound.name = `footstep_${surface.type}`;
                            sound.fn = "playGroup";
                            sound.channel = "sfx";
                        }
                    }
                    if (sound.name && p.playHitSfx) {
                        audioManager[sound.fn](sound.name, {
                            channel: sound.channel,
                            soundPos: p.pos,
                            layer: p.layer,
                            filter: "muffled"
                        });
                    }
                }

                // Strobe effects
                if (p.type == "strobe" && p.strobeSprite) {
                    p.strobeTicker = math.clamp(
                        p.strobeTicker +
                        dt * p.strobeDir * p.strobeSpeed,
                        0,
                        1
                    );
                    p.strobeScale =
                        math.easeInExpo(p.strobeTicker) *
                        p.strobeScaleMax;
                    p.strobeSprite.scale.set(
                        p.strobeScale,
                        p.strobeScale
                    );
                    if (
                        p.strobeScale >= p.strobeScaleMax ||
                        p.strobeTicker <= 0
                    ) {
                        p.strobeDir *= -1;
                    }
                }
                p.sprite.rotation = p.rot;
                p.sprite.alpha = p.inWater ? 0.3 : 1;

                // Trail
                if (itemDef.trail) {
                    const speed = v2.length(vel);
                    const trailT =
                        math.remap(
                            speed,
                            itemDef.throwPhysics.speed * 0.25,
                            itemDef.throwPhysics.speed * 1,
                            0,
                            1
                        ) *
                        math.remap(
                            p.posZ,
                            0.1,
                            GameConfig.projectile.maxHeight * 0.5,
                            0,
                            1
                        );
                    p.trail.scale.set(
                        itemDef.trail.maxLength * trailT,
                        itemDef.trail.width
                    );
                    p.trail.rotation = -Math.atan2(
                        p.dir.y,
                        p.dir.x
                    );
                    p.trail.tint = itemDef.trail.tint;
                    p.trail.alpha = itemDef.trail.alpha * trailT;
                    p.trail.visible = true;
                } else {
                    p.trail.visible = false;
                }

                let layer = p.layer;
                let zOrd = p.posZ < 0.25 ? 14 : 25;
                const stairCollider = collider.createCircle(p.pos, p.rad * 3);
                const onStairs = map.insideStructureStairs(stairCollider);
                const onMask = map.insideStructureMask(stairCollider);
                if (
                    p.posZ >= 0.25 &&
                    !!onStairs &&
                    (p.layer & 1) == (activePlayer.layer & 1) &&
                    (!onMask || !(activePlayer.layer & 2))
                ) {
                    layer |= 2;
                    zOrd += 100;
                }
                if (p.alwaysRenderOntop && activePlayer.layer == 0) {
                    zOrd = 1000;
                    layer |= 2;
                }
                renderer.addPIXIObj(p.container, layer, zOrd);
                const scale =
                    p.imgScale *
                    math.remap(
                        p.posZ,
                        0,
                        GameConfig.projectile.maxHeight,
                        1,
                        4.75
                    );
                const screenPos = camera.pointToScreen(p.pos);
                const screenScale = camera.pixels(scale);
                p.container.position.set(screenPos.x, screenPos.y);
                p.container.scale.set(screenScale, screenScale);
            }
        }
    }
}
