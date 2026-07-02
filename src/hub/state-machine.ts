import type { SessionState } from "../types";
import type { AdapterEvent } from "../adapters/types";

export function nextState(current: SessionState, event: AdapterEvent): SessionState {
  switch (event.type) {
    case "turn-start":
      return "working";
    case "turn-end":
      return current === "working" ? "waiting" : "idle";
    case "needs-input":
      return "waiting";
    case "error":
      return "error";
  }
}
