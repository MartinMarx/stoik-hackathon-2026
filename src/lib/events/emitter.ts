import { EventEmitter } from "events";

declare global {
  var __analysisEmitter: EventEmitter | undefined;
}

const globalEmitter = (globalThis.__analysisEmitter ??= new EventEmitter());
globalEmitter.setMaxListeners(100);

export { globalEmitter };
