import { MapObjectDefs } from "../../shared/defs/mapObjectDefs";
import { type StructureDef, type BuildingDef, type ObstacleDef } from "../../shared/defs/mapObjectsTyping";
import { type MapDef, MapDefs } from "../../shared/defs/mapDefs";
import { type Game } from "./game";
import { GameConfig } from "../../shared/gameConfig";
import { Building } from "./objects/building";
import { ObjectType } from "../../shared/utils/objectSerializeFns";
import { type Decal } from "./objects/decal";
import { Obstacle } from "./objects/obstacle";
import { Structure } from "./objects/structure";
import { type Collider, coldet, type AABB } from "../../shared/utils/coldet";
import { collider } from "../../shared/utils/collider";
import { mapHelpers } from "../../shared/utils/mapHelpers";
import { math } from "../../shared/utils/math";
import { type River } from "../../shared/utils/river";
import { type MapRiverData, generateTerrain } from "../../shared/utils/terrainGen";
import { util } from "../../shared/utils/util";
import { type Vec2, v2 } from "../../shared/utils/v2";
import { MsgStream, MsgType } from "../../shared/net";
import { MapMsg } from "../../shared/msgs/mapMsg";
import { InstantiatePlugin } from "./data/pluginsDefs";

//
// Helpers
//

interface GroundBunkerColliders {
    ground: Collider[]
    bunker: Collider[]
}

const cachedColliders: Record<string, GroundBunkerColliders> = {};

function computeColliders(type: string) {
    const def = MapObjectDefs[type];

    const colliders: GroundBunkerColliders = {
        ground: [],
        bunker: []
    };

    if (def === undefined) return colliders;

    switch (def.type) {
    case "obstacle": {
        colliders.ground.push(def.collision);
        break;
    }
    case "structure": {
        if (def.mapObstacleBounds) {
            for (let i = 0; i < def.mapObstacleBounds.length; i++) {
                colliders.ground.push(...def.mapObstacleBounds);
            }
        }

        for (let i = 0; i < def.layers.length; i++) {
            const layer = def.layers[i];
            const layerColliders = getColliders(layer.type);
            const colliderLayer = i === 0 ? "ground" : "bunker";
            const rot = math.oriToRad(layer.ori);

            for (let j = 0; j < layerColliders.ground.length; j++) {
                const coll = collider.transform(layerColliders.ground[j], layer.pos, rot, 1);
                colliders[colliderLayer].push(coll);
            }
            for (let j = 0; j < layerColliders.bunker.length; j++) {
                const coll = collider.transform(layerColliders.bunker[j], layer.pos, rot, 1);
                colliders[colliderLayer].push(coll);
            }
        }

        break;
    }
    case "building": {
        if (def.mapObstacleBounds) colliders.ground.push(...def.mapObstacleBounds);

        for (const object of def.mapObjects ?? []) {
            const type = typeof object.type === "string"
                ? object.type
                : object.type();

            const objColliders = getColliders(type);
            const rot = math.oriToRad(object.ori);
            for (let j = 0; j < objColliders.ground.length; j++) {
                const coll = collider.transform(objColliders.ground[j], object.pos, rot, 1);
                colliders.ground.push(coll);
            }
            for (let j = 0; j < objColliders.bunker.length; j++) {
                const coll = collider.transform(objColliders.bunker[j], object.pos, rot, 1);
                colliders.bunker.push(coll);
            }
        }

        for (let i = 0; i < def.floor.surfaces.length; i++) {
            const collisions = def.floor.surfaces[i].collision;
            for (let j = 0; j < collisions.length; j++) {
                colliders.ground.push(collisions[j]);
            }
        }
        for (let i = 0; i < def.ceiling.zoomRegions.length; i++) {
            const region = def.ceiling.zoomRegions[i];
            if (region.zoomIn) {
                colliders.ground.push(region.zoomIn);
            }
            if (region.zoomOut) {
                colliders.ground.push(region.zoomOut);
            }
        }
        break;
    }
    case "loot_spawner": {
        colliders.ground.push(collider.createCircle(v2.create(0.0, 0.0), 3.0));
        break;
    }
    }

    return colliders;
}

export function getColliders(type: string) {
    if (cachedColliders[type]) {
        return cachedColliders[type];
    }
    const colliders = computeColliders(type);
    cachedColliders[type] = colliders;
    return colliders;
}

function transformColliders(colls: GroundBunkerColliders, pos: Vec2, rot: number) {
    const newColls: GroundBunkerColliders = {
        ground: [],
        bunker: []
    };
    for (let i = 0; i < colls.ground.length; i++) {
        newColls.ground.push(collider.transform(colls.ground[i], pos, rot, 1));
    }
    for (let i = 0; i < colls.bunker.length; i++) {
        newColls.bunker.push(collider.transform(colls.bunker[i], pos, rot, 1));
    }
    return newColls;
}

function checkCollision(collsA: GroundBunkerColliders, collsB: Collider[], layer: number) {
    const collLayer = layer === 0 ? "ground" : "bunker";
    const layerColls = collsA[collLayer];

    for (let i = 0; i < layerColls.length; i++) {
        const collA = layerColls[i];
        for (let j = 0; j < collsB.length; j++) {
            const collB = collsB[j];
            if (coldet.test(collA, collB)) return true;
        }
    }
    return false;
}

export class GameMap {
    game: Game;

    size:Vec2

    center: Vec2;

    msg = new MapMsg();
    mapStream = new MsgStream(new ArrayBuffer(1 << 15));
    seed = util.randomInt(0, 2 ** 31);

    bounds: AABB;

    objectCount: Record<string, number> = {};

    grassInset: number;
    shoreInset: number;

    terrain!: ReturnType<typeof generateTerrain>;

    mapDef: MapDef;

    riverDescs: MapRiverData[] = [];

    lakes: Array<{
        river: MapRiverData
        center: Vec2
    }> = [];

    obstacles: Obstacle[] = [];
    buildings: Building[] = [];
    structures: Structure[] = [];
    bridges: Structure[] = [];

    constructor(game: Game) {
        this.game = game;

        const mapDef = MapDefs[game.mode.map];
        if (mapDef === undefined) {
            throw new Error(`Invalid map name: ${game.mode.map}`);
        }

        this.mapDef = mapDef;

        const mapConfig = mapDef.mapGen.map;
        this.size=v2.create((mapConfig.baseWidth * mapConfig.scale.small) + mapConfig.extension,(mapConfig.baseHeight * mapConfig.scale.small) + mapConfig.extension)

        this.bounds = collider.createAabb(v2.create(0, 0), v2.create(this.size.x, this.size.y));

        this.msg.mapName = game.mode.map;
        this.msg.seed = this.seed;
        this.msg.width = this.size.x;
        this.msg.height = this.size.y;
        this.msg.rivers = this.riverDescs;
        this.center = v2.create(this.size.x / 2, this.size.y / 2);
        this.grassInset = this.msg.grassInset = mapConfig.grassInset;
        this.shoreInset = this.msg.shoreInset = mapConfig.shoreInset;
    }

    generate(){
        /* const lootPos = v2.create(this.size.x / 2, this.size.y / 2);
        for (const loot in GameObjectDefs) {
            const def = GameObjectDefs[loot];
            if ("lootImg" in def) {
                this.game.grid.addObject(new Loot(this.game, loot, lootPos, 0, 100, 0));
                // this.game.grid.addObject(new Loot(this.game, loot, v2.add(lootPos, { x: 1, y: 1 }), 0, 1, 0));

                lootPos.x += 3.5;
                if (lootPos.x > this.size.x / 2 + 80) {
                    lootPos.x = this.size.x / 2;
                    lootPos.y -= 3.5;
                }
            }
        } */

            this.generateTerrain()

            this.terrain = generateTerrain(
                this.size.x,
                this.size.y,
                this.shoreInset,
                this.grassInset,
                this.riverDescs,
                this.seed
            );
    
            this.generateObjects();
    
            // const data =  require("../../reference/mapMsgData.json")
            // this.msg.objects = data.objects;
            // this.msg.groundPatches = data.groundPatches;
            // this.msg.rivers = data.rivers
    
            this.mapStream.serializeMsg(MsgType.Map, this.msg);
    }

    genPlugins(){
        this.game.events.clearAll()
        for(const p of this.mapDef.gameMode.plugins??[]){
            this.game.addPlugin(InstantiatePlugin(p.id,p.params,p.values))
        }
    }

    generateTerrain(): void {
        const mapConfig = this.mapDef.mapGen.map;
        const riverWeights: number[] = [];
        const weightedWidths: number[][] = [];
        const randomGenerator = util.seededRand(this.seed);
        //
        // Generate rivers
        //
        if(!(mapConfig.rivers===undefined||mapConfig.rivers===null)){
            for (const weightedRiver of mapConfig.rivers.weights) {
                riverWeights.push(weightedRiver.weight);
                weightedWidths.push(weightedRiver.widths);
            }
    
            //
            // Generate lakes
            //
            for (const lake of mapConfig.rivers!.lakes) {
                const points: Vec2[] = [];

                const center = v2.add(v2.mulElems(
                    v2.create(this.size.x, this.size.y),
                    lake.spawnBound.pos
                ), util.randomPointInCircle(lake.spawnBound.rad));

                let len = (lake.outerRad - lake.innerRad);
                const startLen = len;

                for (let i = 0; i < Math.PI * 2; i += randomGenerator(0.2, 0.3)) {
                    const dir = v2.create(Math.sin(i), Math.cos(i));
                    len += randomGenerator(-8, 8);
                    len = math.clamp(len, startLen - 10, startLen + 10);

                    points.push(v2.add(center, v2.mul(dir, len)));
                }

                points.push(v2.copy(points[0]));

                const river = {
                    width: (lake.outerRad - lake.innerRad) / 2,
                    points,
                    looped: true
                };

                this.riverDescs.push(river);

                this.lakes.push({
                    river,
                    center
                });
            }
            //
            // Generate rivers
            //
            const widths = util.weightedRandom(weightedWidths, riverWeights, randomGenerator);
            const halfWidth = this.size.x / 2;
            const halfHeight = this.size.y / 2;

            const riverRect = collider.createAabb(
                v2.create(1, 1),
                v2.create(this.size.x - 1, this.size.y - 1)
            );
            const center = v2.create(halfWidth, halfHeight);
            const mapWidth = this.size.x - 1;
            const mapHeight = this.size.y - 1;

            for (let i = 0; i < widths.length;) {
                let start: Vec2;

                const horizontal = randomGenerator() < 0.5;
                const reverse = randomGenerator() < 0.5;

                if (horizontal) {
                    const topHalf = randomGenerator(1, halfHeight);
                    const bottomHalf = randomGenerator(halfHeight, mapHeight);
                    start = v2.create(1, reverse ? bottomHalf : topHalf);
                } else {
                    const leftHalf = randomGenerator(1, halfWidth);
                    const rightHalf = randomGenerator(halfWidth, mapWidth);
                    start = v2.create(reverse ? rightHalf : leftHalf, 1);
                }

                const smoothness = this.mapDef.mapGen.map.rivers!.smoothness;

                const startAngle = Math.atan2(center.y - start.y, center.x - start.x) + (reverse ? 0 : Math.PI) + randomGenerator(-smoothness, smoothness);

                const riverPoints: Vec2[] = [];

                riverPoints.push(start);

                const dir = v2.create(Math.cos(startAngle), Math.sin(startAngle));

                for (let i = 1; i < 100; i++) {
                    const lastPoint = riverPoints[i - 1];

                    const len = randomGenerator(15, 25);

                    const x = randomGenerator(-smoothness, smoothness);
                    const newdir = v2.add(dir, v2.create(x, x));

                    const pos = v2.add(lastPoint, v2.mul(newdir, len));

                    let collided = false;

                    // end the river if it collides with another river
                    for (const river of this.riverDescs) {
                        const points = river.points;
                        for (let j = 1; j < points.length; j++) {
                            const intersection = coldet.intersectSegmentSegment(lastPoint, pos, points[j - 1], points[j]);
                            if (intersection) {
                                const dist = v2.distance(intersection.point, riverPoints[i - 1]);
                                if (dist > 6) riverPoints[i] = intersection.point;
                                collided = true;
                                break;
                            }
                        }
                        if (collided) break;
                    }
                    if (collided) break;
                    riverPoints[i] = this.clampToMapBounds(pos);

                    if (!coldet.testPointAabb(pos, riverRect.min, riverRect.max)) break;
                }
                if (riverPoints.length < 20) continue;
                this.riverDescs.push({ width: widths[i], points: riverPoints, looped: false });
                i++;
            }
        }
    }

    generateObjects(): void {
        const mapDef = this.mapDef;

        //
        // Generate bridge on rivers
        //
        for (const river of this.terrain.rivers) {
            if (river.looped) continue;

            for (let i = 0.2; i < 0.8; i += 0.05) {
                if (Math.random() > 0.3) continue;

                const pos = river.spline.getPos(i);

                const rot = river.spline.getNormal(i);
                const ori = math.radToOri(Math.atan2(rot.y, rot.x));

                const width = river.waterWidth;

                let bridgeType: string | undefined;
                if (width < 9 && width > 4) {
                    bridgeType = mapDef.mapGen.bridgeTypes.medium;
                } else if (width < 20 && width > 8) {
                    bridgeType = mapDef.mapGen.bridgeTypes.large;
                } else if (width > 20) {
                    bridgeType = mapDef.mapGen.bridgeTypes.xlarge;
                }
                if (!bridgeType) continue;

                if (bridgeType && this.canSpawn(bridgeType, pos, ori)) {
                    const bridge = this.genStructure(bridgeType, pos, 0, ori);
                    this.bridges.push(bridge);
                }
            }
        }

        for (const customSpawnRule of mapDef.mapGen.customSpawnRules.locationSpawns) {
            let pos: Vec2 | undefined;
            let ori: number | undefined;

            let attempts = 0;
            while (attempts++ < GameMap.MaxSpawnAttempts) {
                ori = util.randomInt(0, 3);
                pos = v2.add(
                    util.randomPointInCircle(customSpawnRule.rad),
                    v2.mulElems(customSpawnRule.pos,
                        v2.create(this.size.x, this.size.y)));

                if (this.canSpawn(customSpawnRule.type, pos, ori)) {
                    break;
                }
            }
            if (pos && ori && attempts < GameMap.MaxSpawnAttempts) {
                this.genAuto(customSpawnRule.type, pos);
            }
        }

        // @NOTE: see comment on defs/maps/baseDefs.ts about single item arrays
        const fixedSpawns = mapDef.mapGen.fixedSpawns[0];
        for (const type in fixedSpawns) {
            let count = fixedSpawns[type];
            if (typeof count !== "number") {
                if ("small" in count) {
                    count = count.small;
                } else {
                    count = Math.random() < count.odds ? 1 : 0;
                }
            }
            if ((this.objectCount[type] ?? 0) < count) {
                this.genFromMapDef(type, count);
            }
        }

        for(const randomSpawns of mapDef.mapGen.randomSpawns){
            if (randomSpawns&&randomSpawns.spawns) {
                const spawns = [...randomSpawns.spawns];
                const choose=util.randomValInt(randomSpawns.choose)
                for (let i = 0; i < choose; i++) {
                    const idx = util.randomInt(0, spawns.length - 1);
                    const spawn=spawns[idx]
                    if(typeof spawn==="object" && (spawn.chance<=Math.random())){
                        i--
                        continue
                    }
                    const spawnObj=typeof spawn==="string" ? spawn : (spawn as {value:string,chance:number})["value"] as string
                    if(!randomSpawns.repeat){
                        spawns.splice(idx,1);
                    }
                    this.genFromMapDef(spawnObj, 1);
                }
            }
        }

        const densitySpawns = mapDef.mapGen.densitySpawns[0];
        for (const type in densitySpawns) {
            // TODO: figure out density spawn amount algorithm
            const count = Math.round(util.randomValInt(densitySpawns[type]) * 1.35);
            this.genFromMapDef(type, count);
        }

        for (const place of mapDef.mapGen.places) {
            this.msg.places.push(place);
        }
    }

    genFromMapDef(type: string, count: number): void {
        for (let i = 0; i < count; i++) {
            const def = MapObjectDefs[type];

            if (def.terrain?.waterEdge) {
                this.genOnWaterEdge(type);
            } else if (def.terrain?.grass) {
                this.genOnGrass(type);
            } else if (def.terrain?.beach) {
                this.genOnBeach(type);
            } else if(def.terrain?.river){
                if (def.terrain?.bridge) {
                    this.genOnRiver(type);
                } else if (def.terrain?.lakeCenter) {
                    this.genOnLakeCenter(type);
                }
            }
        }
    }

    genAuto(type: string, pos: Vec2, layer = 0, ori?: number, scale?: number, parentId?: number, puzzlePiece?: string, ignoreMapSpawnReplacement?: boolean) {
        const def = MapObjectDefs[type];

        const spawnReplacements = this.mapDef.mapGen.spawnReplacements[0];
        if (spawnReplacements[type] && !ignoreMapSpawnReplacement) type = spawnReplacements[type];

        pos = this.clampToMapBounds(pos);

        switch (def.type) {
        case "obstacle":
            return this.genObstacle(
                type,
                pos,
                layer,
                ori,
                scale,
                parentId,
                puzzlePiece
            );
        case "building":
            return this.genBuilding(type, pos, layer, ori, parentId);
        case "structure":
            return this.genStructure(type, pos, layer, ori);
        case "decal": {
            const decal = this.game.decalBarn.addDecal(type, pos, layer, ori, scale);
            return decal;
        }
        case "loot_spawner":
            for (const tier of def.loot) {
                const items = this.game.lootBarn.getLootTable(tier.tier);

                for (const item of items) {
                    this.game.lootBarn.addLoot(item.name, pos, layer, item.count, undefined, 0);
                }
            }
            break;
        }
    }

    static collidableTypes = [ObjectType.Obstacle, ObjectType.Building, ObjectType.Structure];

    /**
     * Checks if a map object can spawn at a given position, orientation and scale
     */
    canSpawn(type: string, pos: Vec2, ori: number, scale = 1): boolean {
        const def = MapObjectDefs[type];

        const rot = math.oriToRad(ori);

        const collsA = transformColliders(getColliders(type), pos, rot);

        const boundCollider = collider.transform(mapHelpers.getBoundingCollider(type), pos, rot, scale);
        const objs = this.game.grid.intersectCollider(boundCollider);

        for (let i = 0; i < objs.length; i++) {
            if (!GameMap.collidableTypes.includes(objs[i].__type)) continue;

            const obj = objs[i] as Obstacle | Building | Structure;
            if (checkCollision(collsA, obj.mapObstacleBounds, obj.layer)) return false;
        }

        // checks for bridges and other river structures like crossing bunker
        if (def.type === "structure") {
            if (def.terrain.bridge) {
                for (let i = 0; i < this.bridges.length; i++) {
                    const otherBridge = this.bridges[i];
                    const thatBounds = mapHelpers.getBridgeOverlapCollider(otherBridge.type, otherBridge.pos, otherBridge.rot, 1);
                    if (coldet.test(boundCollider, thatBounds)) {
                        return false;
                    }
                }
            }

            // bridge land bounds are AABBs that should always be on land and never on water
            if (def.bridgeLandBounds) {
                for (let i = 0; i < def.bridgeLandBounds.length; i++) {
                    const bound = collider.transform(def.bridgeLandBounds[i], pos, rot, 1) as AABB;

                    // check all 4 corners of the AABB
                    const points = [
                        bound.min,
                        bound.max,
                        v2.create(bound.min.x, bound.max.y),
                        v2.create(bound.max.x, bound.min.y)
                    ];

                    for (let j = 0; j < points.length; j++) {
                        if (this.getGroundSurface(points[j], 0).type === "water") {
                            return false;
                        }
                    }
                }
            }

            // and water bounds should always be inside water
            if (def.bridgeWaterBounds) {
                for (let i = 0; i < def.bridgeWaterBounds.length; i++) {
                    const bound = collider.transform(def.bridgeWaterBounds[i], pos, rot, 1) as AABB;

                    // check all 4 corners of the AABB
                    const points = [
                        bound.min,
                        bound.max,
                        v2.create(bound.min.x, bound.max.y),
                        v2.create(bound.max.x, bound.min.y)
                    ];

                    for (let j = 0; j < points.length; j++) {
                        if (this.getGroundSurface(points[j], 0).type !== "water") return false;
                    }
                }
            }
        }

        if (!def.terrain?.river &&
            !def.terrain?.bridge
        ) {
            const aabb = collider.toAabb(boundCollider);
            for (let i = 0; i < this.terrain.rivers.length; i++) {
                const river = this.terrain.rivers[i];

                if (!coldet.test(boundCollider, river.aabb)) continue;

                if (!def.terrain?.riverShore &&
                    coldet.testAabbPolygon(aabb.min, aabb.max, river.shorePoly)) return false;

                if (math.pointInsidePolygon(pos, river.waterPoly)) return false;

                if (coldet.testAabbPolygon(aabb.min, aabb.max, river.waterPoly)) return false;
            }
        }

        return true;
    }

    getOriAndScale(type: string): { ori: number, scale: number } {
        let ori = 0;
        let scale = 1;

        const def = MapObjectDefs[type];
        if (def.type === "building" || def.type === "structure") {
            ori = def.ori ?? util.randomInt(0, 3);
            if ("oris" in def) {
                ori = def.oris![util.randomInt(0, def.oris!.length - 1)];
            }
        } else if (def.type === "obstacle") {
            scale = util.random(def.scale.createMin, def.scale.createMax);
        }

        return { ori, scale };
    }

    static MaxSpawnAttempts = 1000;

    genOnWaterEdge(type: string): void {
        const def = MapObjectDefs[type] as BuildingDef | StructureDef;
        // safety check + makes ts shut up about it being possibly undefined
        const waterEdge = def.terrain.waterEdge;
        if (!waterEdge) return;

        const aabb = collider.toAabb(mapHelpers.getBoundingCollider(type));
        // const size.x = aabb.max.x - aabb.min.x;
        const width = aabb.max.y - aabb.min.y;

        let ori: number;
        let pos: Vec2 | undefined;

        let attempts = 0;
        let collided = true;

        const edgeRot = Math.atan2(waterEdge.dir.y, waterEdge.dir.x);

        while (attempts++ < GameMap.MaxSpawnAttempts && collided) {
            collided = false;

            const side = util.randomInt(0, 3);

            const rot = math.oriToRad(side);

            ori = math.radToOri(rot - edgeRot);

            let dist = util.random(waterEdge.distMin, waterEdge.distMax);

            // TODO: figure out how to use distance values from definitions

            if (type.includes("hut")) {
                dist -= 16;
            } else if (type === "warehouse_complex_01") {
                dist -= this.shoreInset - 6.5;
            } else if (type === "bunker_structure_04") {
                dist -= 24;
            }

            const min = v2.create(this.shoreInset + dist, this.shoreInset + width);
            const max = v2.create(min.x, this.size.y - this.shoreInset - width);

            // generate a position and rotate it based on the orientation and map center
            const tempPos = {
                x: util.random(min.x, max.x),
                y: util.random(min.y, max.y)
            };
            const offset = v2.sub(this.center, tempPos);
            pos = v2.add(this.center, v2.rotate(offset, rot));

            if (!this.canSpawn(type, pos, ori!, 1)) {
                collided = true;
            }
        }

        if (pos && attempts < GameMap.MaxSpawnAttempts) {
            this.genAuto(type, pos, 0, ori!, 1);
        }
    }

    genOnGrass(type: string) {
        const bounds = collider.toAabb(mapHelpers.getBoundingCollider(type));

        const { ori, scale } = this.getOriAndScale(type);

        let width = bounds.max.x - bounds.min.x;
        let height = bounds.max.y - bounds.min.y;

        const def = MapObjectDefs[type];
        if (!def.terrain?.beach) {
            width += this.grassInset;
            height += this.grassInset;
        }

        const getPos = () => {
            return {
                x: util.random(this.shoreInset + width, this.size.x - this.shoreInset - width),
                y: util.random(this.shoreInset + height, this.size.y - this.shoreInset - height)
            };
        };

        let pos: Vec2 | undefined;
        let attempts = 0;
        let collided = true;

        while (attempts++ < GameMap.MaxSpawnAttempts && collided) {
            collided = false;
            pos = getPos();

            if (!this.canSpawn(type, pos, ori, scale)) {
                collided = true;
            }
        }

        if (pos && attempts < GameMap.MaxSpawnAttempts) {
            this.genAuto(type, pos, 0, ori, scale);
        }
    }

    genOnBeach(type: string) {
        const aabb = collider.toAabb(mapHelpers.getBoundingCollider(type));
        const width = aabb.max.x - aabb.min.x;
        const height = aabb.max.y - aabb.min.y;
        const { ori, scale } = this.getOriAndScale(type);

        let pos: Vec2 | undefined;

        let attempts = 0;
        let collided = true;

        while (attempts++ < GameMap.MaxSpawnAttempts && collided) {
            collided = false;

            const side = util.randomInt(0, 3);
            const rot = math.oriToRad(side);

            const min = v2.create(this.shoreInset + width, this.shoreInset + width + this.grassInset);
            const max = v2.create(min.x, this.size.y - this.shoreInset - height);

            // generate a position and rotate it based on the orientation and map center
            const tempPos = {
                x: util.random(min.x, max.x),
                y: util.random(min.y, max.y)
            };
            const offset = v2.sub(this.center, tempPos);
            pos = v2.add(this.center, v2.rotate(offset, rot));

            if (!this.canSpawn(type, pos, ori, 1)) {
                collided = true;
            }
        }

        if (pos && attempts < GameMap.MaxSpawnAttempts) {
            this.genAuto(type, pos, 0, ori, scale);
        }
    }

    genOnRiver(type: string) {
        let { ori, scale } = this.getOriAndScale(type);

        const def = MapObjectDefs[type];

        const getPos = () => {
            const oriAndScale = this.getOriAndScale(type);
            ori = oriAndScale.ori;
            scale = oriAndScale.scale;

            const river = this.terrain.rivers[util.randomInt(0, this.terrain.rivers.length - 1)];
            const t = util.random(0.2, 0.8);
            let pos = river.spline.getPos(t);

            if (def.terrain?.nearbyRiver) {
                const norm = river.spline.getNormal(t);
                const riverOri = math.radToOri(Math.atan2(norm.y, norm.x));
                ori = (def.terrain.nearbyRiver.facingOri + riverOri) % 4;

                pos = v2.add(pos, v2.rotate(v2.create(river.waterWidth * 2, river.waterWidth * 2), math.oriToRad(riverOri)));
            }
            return pos;
        };

        let pos: Vec2 | undefined;
        let attempts = 0;
        let collided = true;

        while (attempts++ < GameMap.MaxSpawnAttempts && collided) {
            collided = false;
            pos = getPos();

            if (!this.canSpawn(type, pos, ori, scale)) {
                collided = true;
            }
        }

        if (pos && attempts < GameMap.MaxSpawnAttempts) {
            this.genAuto(type, pos, 0, ori, scale);
        } else {
            console.warn(`Failed to generate ${type} on river`);
        }
    }

    genOnLakeCenter(type: string) {
        const lake = this.lakes[util.randomInt(0, this.lakes.length - 1)];
        const pos = lake.center;

        this.genAuto(type, pos, 0, 0);
    }

    genObstacle(type: string, pos: Vec2, layer = 0, ori?: number, scale?: number, buildingId?: number, puzzlePiece?: string): Obstacle {
        pos = this.clampToMapBounds(pos);
        const def = MapObjectDefs[type] as ObstacleDef;

        scale = scale ?? util.random(def.scale.createMin, def.scale.createMax);

        const obstacle = new Obstacle(
            this.game,
            pos,
            type,
            layer,
            ori,
            scale,
            buildingId,
            puzzlePiece
        );
        this.game.objectRegister.register(obstacle);
        this.obstacles.push(obstacle);

        if (def.map?.display && layer === 0) this.msg.objects.push(obstacle);
        this.objectCount[type]++;
        return obstacle;
    }

    genBuilding(type: string, pos: Vec2, layer = 0, ori?: number, parentId?: number): Building {
        pos = this.clampToMapBounds(pos);
        const def = MapObjectDefs[type] as BuildingDef;

        ori = ori ?? def.ori ?? util.randomInt(0, 3);

        const building = new Building(this.game, type, pos, ori, layer, parentId);
        this.game.objectRegister.register(building);
        this.buildings.push(building);

        if (def.map?.display && layer === 0) this.msg.objects.push(building);

        for (const mapObject of def.mapObjects ?? []) {
            let partType = mapObject.type;

            if (typeof partType !== "string") {
                partType = partType();
            }
            if (!partType) continue;

            let partOri: number;
            if (mapObject.inheritOri === false) partOri = mapObject.ori;
            else partOri = (mapObject.ori + ori) % 4;

            const partPos = math.addAdjust(pos, mapObject.pos, ori);

            const obj = this.genAuto(partType,
                partPos,
                layer,
                partOri,
                mapObject.scale,
                building.__id,
                mapObject.puzzlePiece,
                mapObject.ignoreMapSpawnReplacement
            );

            if (obj) building.childObjects.push(obj);
        }

        for (const patch of def.mapGroundPatches ?? []) {
            this.msg.groundPatches.push({
                min: math.addAdjust(pos, patch.bound.min, ori),
                max: math.addAdjust(pos, patch.bound.max, ori),
                color: patch.color,
                roughness: patch.roughness ?? 0,
                offsetDist: patch.offsetDist ?? 0,
                order: patch.order ?? 0,
                useAsMapShape: patch.useAsMapShape ?? true
            });
        }

        this.objectCount[type]++;
        return building;
    }

    genStructure(type: string, pos: Vec2, layer = 0, ori?: number): Structure {
        pos = this.clampToMapBounds(pos);
        const def = MapObjectDefs[type] as StructureDef;

        ori = ori ?? def.ori ?? util.randomInt(0, 3);

        const structure = new Structure(this.game, type, pos, layer, ori);
        this.game.objectRegister.register(structure);
        this.structures.push(structure);

        layer = 0;
        for (const layerDef of def.layers) {
            const building = this.genBuilding(
                layerDef.type,
                math.addAdjust(pos, layerDef.pos, ori),
                layer,
                (layerDef.ori + ori) % 4,
                structure.__id
            );
            layer++;
            structure.layerObjIds.push(building.__id);
        }

        this.objectCount[type]++;
        return structure;
    }

    getRandomSpawnPos(getPos:()=>Vec2 = () => {
        return {
            x: util.random(this.shoreInset, this.size.x - this.shoreInset),
            y: util.random(this.shoreInset, this.size.y - this.shoreInset)
        };
    }): Vec2 {
        let attempts = 0;
        let collided = true;

        const circle = collider.createCircle(getPos(), GameConfig.player.radius);

        while (attempts++ < 200 && collided) {
            collided = false;
            v2.set(circle.pos, getPos());

            const objs = this.game.grid.intersectCollider(circle);

            for (const obj of objs) {
                if (obj.layer !== 0) continue;
                if (obj instanceof Obstacle && coldet.test(obj.collider, circle)) {
                    collided = true;
                    break;
                }

                if (obj instanceof Building || obj instanceof Structure) {
                    for (const bound of obj.mapObstacleBounds) {
                        if (coldet.test(bound, circle)) {
                            collided = true;
                            break;
                        }
                    }
                    if (collided) break;
                }
            }
            if(this.game.gas.isInGas(circle.pos)){
                collided=true
            }
        }

        return circle.pos;
    }

    clampToMapBounds(pos: Vec2): Vec2 {
        return coldet.clampPosToAabb(pos, this.bounds);
    }

    getGroundSurface(pos: Vec2, layer: number) {
        const groundSurface = (type: string, river?: River) => {
            return { type, river };
        };

        const objs = this.game.grid.intersectPos(pos);

        // Check decals
        const decals = objs.filter(obj => obj.__type === ObjectType.Decal) as Decal[];
        for (let i = 0; i < decals.length; i++) {
            const decal = decals[i];
            if (!decal.surface) {
                continue;
            }

            if (util.sameLayer(decal.layer, layer) && collider.intersectCircle(decal.collider!, pos, 0.0001)) {
                return groundSurface(decal.surface);
            }
        }

        // Check buildings
        let surface = null;
        let zIdx = 0;
        const onStairs = layer & 0x2;

        const buildings = objs.filter(obj => obj.__type === ObjectType.Building) as Building[];

        for (let i = 0; i < buildings.length; i++) {
            const building = buildings[i];
            if (building.zIdx < zIdx) {
                continue;
            }
            // Prioritize layer0 building surfaces when on stairs
            // eslint-disable-next-line no-mixed-operators
            if (building.layer !== layer && !onStairs || building.layer === 1 && onStairs) {
                continue;
            }
            for (let j = 0; j < building.surfaces.length; j++) {
                const s = building.surfaces[j];
                for (let k = 0; k < s.colliders.length; k++) {
                    const res = collider.intersectCircle(s.colliders[k], pos, 0.0001);
                    if (res) {
                        zIdx = building.zIdx;
                        surface = s;
                        break;
                    }
                }
            }
        }

        if (surface) {
            return groundSurface(surface.type);
        }

        // Check rivers
        let onRiverShore = false;
        if (layer !== 1) {
            const { rivers } = this.terrain;
            for (let i = 0; i < rivers.length; i++) {
                const river = rivers[i];
                if (coldet.testPointAabb(pos, river.aabb.min, river.aabb.max) && math.pointInsidePolygon(pos, river.shorePoly)) {
                    onRiverShore = true;
                    if (math.pointInsidePolygon(pos, river.waterPoly)) {
                        return groundSurface("water", river);
                    }
                }
            }
        }

        // Check terrain
        if (math.pointInsidePolygon(pos, this.terrain.grass)) {
            // Use a stone step sound if we're in the main-spring def
            return groundSurface(onRiverShore ? this.mapDef.biome.sound.riverShore : "grass");
        } if (math.pointInsidePolygon(pos, this.terrain.shore)) {
            return groundSurface("sand");
        }
        return groundSurface("water");
    }
}
