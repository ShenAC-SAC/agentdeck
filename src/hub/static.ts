const DEFAULT_ROOT = new URL("../../web/dist/", import.meta.url).pathname;

// Maps a URL path to a file under the built web app. Returns null when the
// file is absent so the caller can fall back (SPA index / API 404).
export async function serveStatic(pathname: string, root: string = DEFAULT_ROOT): Promise<Response | null> {
  const base = root.endsWith("/") ? root : `${root}/`;
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = Bun.file(base + rel);
  return (await file.exists()) ? new Response(file) : null;
}
