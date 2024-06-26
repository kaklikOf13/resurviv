import { MapObjectDefs } from "../../../shared/defs/mapObjectDefs";
import { coldet } from "../../../shared/utils/coldet";
import { collider } from "../../../shared/utils/collider";
import { mapHelpers } from "../../../shared/utils/mapHelpers";
import { math } from "../../../shared/utils/math";
import { v2 } from "../../../shared/utils/v2";
import { renderBridge, renderMapBuildingBounds, renderWaterEdge } from "../debugHelpers";
import { device } from "../device";

export class Structure {
    init() {
        this.soundTransitionT = 0;
    }

    free() { }
    updateData(data, fullUpdate, isNew, ctx) {
        if (fullUpdate) {
            this.type = data.type;
            this.layer = 0;
            this.pos = v2.copy(data.pos);
            this.rot = math.oriToRad(data.ori);
            this.scale = 1;
            this.interiorSoundAlt = data.interiorSoundAlt;
            this.interiorSoundEnabled = data.interiorSoundEnabled;
            if (isNew) {
                this.soundTransitionT = this.interiorSoundAlt
                    ? 1
                    : 0;
                this.soundEnabledT = this.interiorSoundEnabled
                    ? 1
                    : 0;
            }
            this.aabb = collider.transform(
                mapHelpers.getBoundingCollider(this.type),
                this.pos,
                this.rot,
                this.scale
            );
            const def = MapObjectDefs[this.type];
            this.layers = [];
            for (let p = 0; p < def.layers.length; p++) {
                const layer = def.layers[p];
                const objId = data.layerObjIds[p];

                const inheritOri =
                    layer.inheritOri === undefined || layer.inheritOri;
                const underground =
                    layer.underground !== undefined
                        ? layer.underground
                        : p == 1;
                const pos = v2.add(this.pos, layer.pos);
                const rot = math.oriToRad(inheritOri ? data.ori + layer.ori : layer.ori);
                const collision = collider.transform(
                    mapHelpers.getBoundingCollider(layer.type),
                    pos,
                    rot,
                    1
                );
                this.layers.push({
                    objId,
                    collision,
                    underground
                });
            }
            this.stairs = [];
            for (let _ = 0; _ < def.stairs.length; _++) {
                const stairsDef = def.stairs[_];
                const stairsCol = collider.transform(
                    stairsDef.collision,
                    this.pos,
                    this.rot,
                    this.scale
                );
                const downDir = v2.rotate(stairsDef.downDir, this.rot);
                const childAabbs = coldet.splitAabb(stairsCol, downDir);

                this.stairs.push({
                    collision: stairsCol,
                    center: v2.add(
                        stairsCol.min,
                        v2.mul(v2.sub(stairsCol.max, stairsCol.min), 0.5)
                    ),
                    downDir,
                    downAabb: collider.createAabb(childAabbs[0].min, childAabbs[0].max),
                    upAabb: collider.createAabb(childAabbs[1].min, childAabbs[1].max),
                    noCeilingReveal: !!stairsDef.noCeilingReveal,
                    lootOnly: !!stairsDef.lootOnly
                });
            }
            this.mask = [];
            for (let i = 0; i < def.mask.length; i++) {
                this.mask.push(
                    collider.transform(
                        def.mask[i],
                        this.pos,
                        this.rot,
                        this.scale
                    )
                );
            }
            ctx.renderer.layerMaskDirty = true;
        }
    }

    update(dt, map, activePlayer, ambience) {
        if (MapObjectDefs[this.type].interiorSound) {
            this.updateInteriorSounds(dt, map, activePlayer, ambience);
        }
    }

    /**
     * @param {number} dt
     * @param {import("../map").Map} map
     * @param {import("./player").Player} activePlayer
     * @param {import("./ambiance").Ambiance} ambience
    */
    updateInteriorSounds(dt, map, activePlayer, ambience) {
        const def = MapObjectDefs[this.type];
        collider.createCircle(activePlayer.pos, 0.001);
        map.buildingPool.getPool();
        const building0 =
            this.layers.length > 0
                ? map.getBuildingById(this.layers[0].objId)
                : null;
        const building1 =
            this.layers.length > 1
                ? map.getBuildingById(this.layers[1].objId)
                : null;
        const maxDist =
            def.interiorSound.outsideMaxDist !== undefined
                ? def.interiorSound.outsideMaxDist
                : 10;
        const outsideVol =
            def.interiorSound.outsideVolume !== undefined
                ? def.interiorSound.outsideVolume
                : 0;
        const undergroundVol =
            def.interiorSound.undergroundVolume !== undefined
                ? def.interiorSound.undergroundVolume
                : 1;

        // Compute weights for the normal (weight0) and filtered (weight1) tracks
        let weight0 = 0;
        let weight1 = 0;
        if (activePlayer.layer != 1) {
            if (building0) {
                // Play the filtered sound when we can't see inside the building,
                // and reduce the volume based on distance from the building.
                const dist = building0.getDistanceToBuilding(activePlayer.pos, maxDist);
                const weight = math.remap(dist, maxDist, 0, 0, 1);
                const onStairs = activePlayer.layer & 2;
                const visionT = building0.ceiling.fadeAlpha;
                weight0 = weight * (1 - visionT);
                weight1 = weight * visionT * (onStairs ? undergroundVol : outsideVol);
            }
        } else if (building1) {
            // Immediately play the filtered track at  full weight when
            // going underground; the filter and reverb effects delay the sound
            // slightly which ends up sounding okay without a crossfade.
            const dist = building1.getDistanceToBuilding(activePlayer.pos, maxDist);
            const weight = math.remap(dist, maxDist, 0, 0, 1);
            weight0 = 0;
            weight1 = weight * undergroundVol;
        }

        // Transition between sound and soundAlt tracks
        const transitionTime =
            def.interiorSound.transitionTime !== undefined
                ? def.interiorSound.transitionTime
                : 1;
        if (this.interiorSoundAlt) {
            this.soundTransitionT = math.clamp(
                this.soundTransitionT + dt / transitionTime,
                0,
                1
            );
        }
        const transitionWeight = Math.abs(this.soundTransitionT - 0.5) * 2;

        // Fade out the track after it's disabled
        if (!this.interiorSoundEnabled) {
            this.soundEnabledT = math.clamp(
                this.soundEnabledT - dt * 0.5,
                0,
                1
            );
        }

        // Choose the actual track based on the state of the transition
        const sound =
            this.soundTransitionT > 0.5
                ? def.interiorSound.soundAlt
                : def.interiorSound.sound;

        // Set the track data
        const track0 = ambience.getTrack("interior_0");
        track0.sound = sound;
        track0.filter = "";
        track0.weight = sound ? weight0 * transitionWeight * this.soundEnabledT : 0;

        const track1 = ambience.getTrack("interior_1");
        track1.sound = sound;
        track1.filter = def.interiorSound.filter;
        track1.weight = sound ? weight1 * transitionWeight * this.soundEnabledT : 0;
    }

    render(camera, debug, layer) {
        if (device.debug) {
            renderMapBuildingBounds(this);
            renderBridge(this);
            renderWaterEdge(this);
        }
    }

    insideStairs(collision) {
        for (let i = 0; i < this.stairs.length; i++) {
            if (collider.intersect(this.stairs[i].collision, collision)) {
                return true;
            }
        }
        return false;
    }

    insideMask(collision) {
        for (let i = 0; i < this.mask.length; i++) {
            if (collider.intersect(this.mask[i], collision)) {
                return true;
            }
        }
        return false;
    }
}
