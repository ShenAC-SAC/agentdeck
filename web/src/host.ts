interface DeckDialog {
  pickFolder(): Promise<string | null>;
}

declare global {
  interface Window {
    deckdialog?: DeckDialog;
  }
}

export async function pickFolder(): Promise<string | null> {
  if (window.deckdialog) return window.deckdialog.pickFolder();
  const p = window.prompt("Workspace directory", "~");
  return p && p.trim() ? p.trim() : null;
}
