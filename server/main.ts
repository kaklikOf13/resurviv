import { argv } from "process"
import { Config } from "./src/config"
import {NodeServer} from "./src/nodeServer"
import path from "path"
import { Worker } from "worker_threads"
let childPorts=false
for(const a of argv){
    switch(a){
        case "--childPorts":
            childPorts=true
    }
}
if(childPorts){
    for(const p of Config.childPorts||[]){
        //@ts-expect-error
        const worker=new Worker(path.resolve(__dirname, `worker.${process[Symbol.for("ts-node.register.instance")] ? "ts" : "js"}`),{workerData:{port:p}})
    }
}
const server=new NodeServer()
server.run()