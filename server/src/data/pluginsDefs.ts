import { CreateObjectAfterDeathPlugin } from "../plugins/createObjectAfterDeath";
import { HealingAfterKillPlugin } from "../plugins/healingAfterKill";
import { WeaponSwampPlugin } from "../plugins/weaponSwamp";
import { GamePlugin } from "../utils/plugins";
export type Plugins=Record<string,new(...params:any[])=>GamePlugin>
export type PluginInstance={
    id:string,
    params?:any[],
    values?:Record<string,any>
}
export const pluginsDefs:Plugins={
    healing_after_kill:HealingAfterKillPlugin,
    weapon_swamp:WeaponSwampPlugin,
    create_object_after_death:CreateObjectAfterDeathPlugin
}
export function InstantiatePlugin(id:string,params:any[]=[],values:Record<string,any>={},defs:Plugins=pluginsDefs):GamePlugin{
    const ret=new pluginsDefs[id](...params)
    for(const k of Object.keys(values)){
        //@ts-expect-error
        ret[k]=values[k]
    }
    return ret
}