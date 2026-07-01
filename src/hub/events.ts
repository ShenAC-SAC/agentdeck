import { EventEmitter } from "node:events";

export function makeBus(): EventEmitter {
  return new EventEmitter();
}
