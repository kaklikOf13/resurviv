import {NodeServer} from "./src/nodeServer"
import { workerData } from "worker_threads"
const server=new NodeServer()
server.main=false
server.run(workerData.port)