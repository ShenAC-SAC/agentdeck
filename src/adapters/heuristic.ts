import { tmux } from "../tmux/tmux";

// A session is "idle" when its pane output has stopped changing for long enough.
export function detectIdle(prev: string, curr: string, elapsedMs: number, thresholdMs: number): boolean {
  return prev === curr && elapsedMs >= thresholdMs;
}

// Fallback for agents with no precise event surface: poll capture-pane, and when
// output has been stable past the threshold, report a turn-end once to the hub.
export function startHeuristicPoller(
  target: string,
  sessionId: string,
  hubPort: number,
  opts: { intervalMs: number; thresholdMs: number } = { intervalMs: 1000, thresholdMs: 4000 },
): () => void {
  let prev = "";
  let stableSince = Date.now();
  let reported = false;
  const timer = setInterval(async () => {
    const curr = await tmux.capturePane(target);
    if (curr !== prev) {
      prev = curr;
      stableSince = Date.now();
      reported = false;
      return;
    }
    if (!reported && detectIdle(prev, curr, Date.now() - stableSince, opts.thresholdMs)) {
      reported = true;
      const url = `http://localhost:${hubPort}/events?sessionId=${encodeURIComponent(sessionId)}&agent=generic`;
      await fetch(url, { method: "POST", body: JSON.stringify({ type: "turn-complete" }) }).catch(() => {});
    }
  }, opts.intervalMs);
  return () => clearInterval(timer);
}
