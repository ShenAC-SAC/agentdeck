import { expect, test } from "bun:test";
import { inflateSync } from "node:zlib";

test("package exposes the AgentDeck product name", async () => {
  const pkg = JSON.parse(await Bun.file("package.json").text()) as { productName?: string };
  expect(pkg.productName).toBe("AgentDeck");
});

test("desktop shell uses a tray image and activate-to-show behavior", async () => {
  const main = await Bun.file("electron/main.cjs").text();
  expect(main).toContain("TRAY_ICON_PATH");
  expect(main).toContain("new Tray(");
  expect(main).not.toContain("nativeImage.createEmpty()");
  expect(main).not.toContain('tray.setTitle("⚓")');
  expect(main).toContain('app.on("activate"');
});

test("dock icon png does not have an opaque white frame", async () => {
  const png = await Bun.file("electron/assets/icon.png").arrayBuffer();
  const pixel = firstPixelRGBA(new Uint8Array(png));
  const opaqueWhite = pixel[0] > 245 && pixel[1] > 245 && pixel[2] > 245 && pixel[3] > 245;
  expect(opaqueWhite).toBe(false);
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
