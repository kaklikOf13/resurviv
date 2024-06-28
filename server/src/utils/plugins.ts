import { type Game } from "../game"
import { type DamageParams } from "../objects/gameObject"
import { type Player } from "../objects/player"

export enum EventType{
    GameStart,
    GameTick,
    GameEnd,
    GameRun,
    GameClose,
    PlayerDie,
    PlayerJoin
}
export interface EventMap {
    [EventType.GameStart]: Game
    [EventType.GameTick]: Game
    [EventType.GameEnd]: {game:Game,winners:Player[]}
    [EventType.GameRun]: Game
    [EventType.GameClose]:Game
    [EventType.PlayerDie]:{player:Player,killer:DamageParams}
    [EventType.PlayerJoin]:Player
}

export type EventHandlers<Events extends EventType=EventType,EventDataMap extends EventMap=EventMap>=Record<Events,Array<(data: EventDataMap[Events]) => void>>
export class EventsManager<Events extends EventType=EventType,EventDataMap extends EventMap=EventMap> {
    signals:Partial<EventHandlers<Events,EventDataMap>>

    constructor() {
        this.signals={}
    }

    on<Ev extends Events>(signal: Ev, cb?: (data: EventDataMap[Ev]) => void): void {
        ((this.signals[signal] as Set<typeof cb> | undefined) ??= new Set()).add(cb);
    }

    off<Ev extends Events>(eventType: Ev, cb?: (data: EventDataMap[Ev]) => void): void {
        if (!cb) {
            delete this.signals[eventType];
            return;
        }

        (this.signals[eventType] as Set<typeof cb> | undefined)?.delete(cb);
    }

    emit<Ev extends Events>(eventType: Ev, data: EventDataMap[Ev]): void {
        for (const cb of this.signals[eventType]||[]) {
            if(cb){
                cb(data)
            }
        }
    }

    clear(eventType: Events): void {
        this.signals[eventType]=[]
    }
    clearAll(): void {
        this.signals={}
    }
}