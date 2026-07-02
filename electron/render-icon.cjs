const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SVG_PATH = path.join(ROOT, "electron", "assets", "icon.svg");
const OUT_PATH = process.argv[2] || path.join(ROOT, "electron", "assets", "icon.png");

app.whenReady().then(async () => {
  const svg = fs.readFileSync(SVG_PATH, "utf8");
  const win = new BrowserWindow({
    show: false,
    width: 1024,
    height: 1024,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadURL("data:text/html,<html><body></body></html>");
  const dataUrl = await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext("2d");
      const image = new Image();
      image.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      image.onerror = () => reject(new Error("failed to render icon svg"));
      image.src = ${JSON.stringify(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`)};
    })
  `);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, Buffer.from(dataUrl.split(",")[1], "base64"));
  win.destroy();
  app.quit();
});
