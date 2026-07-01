// Typed view of the bridge exposed by electron/preload.cjs. Absent in a plain
// browser, so callers feature-detect via hasPty() and fall back to jump.
export interface DeckPty {
  open(id: string, target: string, cols: number, rows: number): Promise<{ ok: boolean; error?: string }>;
  write(id: string, data: string): void;
  resize(id: string, cols: number, rows: number): void;
  close(id: string): void;
  onData(id: string, cb: (data: string) => void): () => void;
  onExit(id: string, cb: () => void): () => void;
}

declare global {
  interface Window {
    deckpty?: DeckPty;
  }
}

export function hasPty(): boolean {
  return typeof window !== "undefined" && !!window.deckpty;
}
