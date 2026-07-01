export type AdapterEvent =
  | { type: "turn-start"; sessionId: string; at: number }
  | { type: "turn-end"; sessionId: string; at: number; summary?: string }
  | { type: "needs-input"; sessionId: string; at: number; summary?: string }
  | { type: "error"; sessionId: string; at: number; summary?: string };
