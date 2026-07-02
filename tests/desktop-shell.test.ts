import { expect, test } from "bun:test";
import { createRequire } from "node:module";
import { inflateSync } from "node:zlib";

const require = createRequire(import.meta.url);
const { nextAttentionBadge } = require("../electron/attention-badge.cjs") as {
  nextAttentionBadge: (
    seen: Map<string, string>,
    sessions: Array<{ id: string; state: string; lastActivityAt: number; staleSince?: number | null }>,
    openSessionId?: string | null,
    focused?: boolean,
  ) => { unread: number; seen: Map<string, string> };
};

test("package exposes the AgentDeck product name", async () => {
  const pkg = JSON.parse(await Bun.file("package.json").text()) as { productName?: string };
  expect(pkg.productName).toBe("AgentDeck");
});

test("desktop shell uses a tray image and activate-to-show behavior", async () => {
  const main = await Bun.file("electron/main.cjs").text();
  expect(main).toContain("TRAY_ICON_PATH");
  expect(main).toContain("new Tray(");
  expect(main).not.toContain("nativeImage.createEmpty()");
  expect(main).not.toContain("⚓");
  expect(main).toContain("tray.setTitle(unread > 0 ? String(unread) : \"\")");
  expect(main).toContain('app.on("activate"');
});

test("dev app launcher brands the macOS bundle as AgentDeck", async () => {
  const pkg = JSON.parse(await Bun.file("package.json").text()) as { scripts?: Record<string, string> };
  const launcher = await Bun.file("electron/dev-launch.cjs").text();
  expect(pkg.scripts?.app).toContain("electron:dev");
  expect(pkg.scripts?.["electron:dev"]).toContain("electron/dev-launch.cjs");
  expect(launcher).toContain("AgentDeck.app");
  expect(launcher).toContain("verbatimSymlinks: true");
  expect(launcher).toContain("Contents\", \"MacOS\", \"Electron\"");
  expect(launcher).toContain("CFBundleDisplayName");
  expect(launcher).toContain("com.agentdeck.dev");
});

test("dock icon png has a transparent outside corner", async () => {
  const png = await Bun.file("electron/assets/icon.png").arrayBuffer();
  const pixel = firstPixelRGBA(new Uint8Array(png));
  expect(pixel[3]).toBe(0);
});

test("frontmost open attention is seen but remains an attention state", () => {
  const s = { id: "s1", state: "waiting", lastActivityAt: 10 };
  const result = nextAttentionBadge(new Map(), [s], "s1", true);
  expect(result.unread).toBe(0);
  expect(result.seen.has("s1")).toBe(true);
  expect(s.state).toBe("waiting");
});

test("background attention remains unread until the open session is focused", () => {
  const first = nextAttentionBadge(
    new Map(),
    [
      { id: "s1", state: "waiting", lastActivityAt: 10 },
      { id: "s2", state: "waiting", lastActivityAt: 20 },
    ],
    "s1",
    false,
  );
  expect(first.unread).toBe(2);

  const focused = nextAttentionBadge(first.seen, [
    { id: "s1", state: "waiting", lastActivityAt: 10 },
    { id: "s2", state: "waiting", lastActivityAt: 20 },
  ], "s1", true);
  expect(focused.unread).toBe(1);
});

test("a later handoff for a seen session becomes unread again", () => {
  const seen = nextAttentionBadge(new Map(), [{ id: "s1", state: "waiting", lastActivityAt: 10 }], "s1", true);
  const later = nextAttentionBadge(seen.seen, [{ id: "s1", state: "waiting", lastActivityAt: 99 }], "other", true);
  expect(later.unread).toBe(1);
});

function firstPixelRGBA(bytes: Uint8Array): [number, number, number, number] {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < sig.length; i++) expect(bytes[i]).toBe(sig[i]);

  let off = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (off < bytes.length) {
    const len = readU32(bytes, off);
    const type = new TextDecoder().decode(bytes.slice(off + 4, off + 8));
    const data = bytes.slice(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = readU32(data, 0);
      height = readU32(data, 4);
      expect(data[8]).toBe(8); // bit depth
      expect(data[9]).toBe(6); // RGBA
      expect(data[12]).toBe(0); // no interlace
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    off += 12 + len;
  }
  expect(width).toBeGreaterThan(0);
  expect(height).toBeGreaterThan(0);
  const inflated = inflateSync(Buffer.concat(idat.map((x) => Buffer.from(x))));
  // The first pixel has no left/up neighbors, so every legal PNG filter leaves
  // these raw RGBA bytes unchanged for this one pixel.
  return [inflated[1], inflated[2], inflated[3], inflated[4]];
}

function readU32(bytes: Uint8Array, off: number): number {
  return ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
}
