import { RedisQueueAdapter } from "./RedisAdapter";
const DRIVER = (process.env.QUEUE_DRIVER || 'redis').toLowerCase();
let impl: any;
if (DRIVER === 'redis') impl = new RedisQueueAdapter();
export const STEP_READY_TOPIC = "step.ready";
export const enqueue = (topic:string, payload:any)=>impl.enqueue(topic,payload);
export const subscribe = (topic:string, handler:(p:any)=>Promise<void>)=>impl.subscribe(topic,handler);