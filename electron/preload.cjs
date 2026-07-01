// Bridges the renderer (xterm.js) to node-pty in the main process. Only a tiny,
// explicit surface is exposed on window.deckpty; the web app feature-detects it
// (present under Electron, absent in a plain browser -> falls back to jump).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("deckpty", {
  open: (id, target, host, cols, rows) => ipcRenderer.invoke("pty:open", { id, target, host, cols, rows }),
  write: (id, data) => ipcRenderer.send("pty:write", { id, data }),
  resize: (id, cols, rows) => ipcRenderer.send("pty:resize", { id, cols, rows }),
  close: (id) => ipcRenderer.send("pty:close", { id }),
  onData: (id, cb) => {
    const listener = (_e, msg) => {
      if (msg.id === id) cb(msg.data);
    };
    ipcRenderer.on("pty:data", listener);
    return () => ipcRenderer.removeListener("pty:data", listener);
  },
  onExit: (id, cb) => {
    const listener = (_e, msg) => {
      if (msg.id === id) cb();
    };
    ipcRenderer.on("pty:exit", listener);
    return () => ipcRenderer.removeListener("pty:exit", listener);
  },
});

contextBridge.exposeInMainWorld("deckdialog", {
  pickFolder: () => ipcRenderer.invoke("dialog:pickFolder"),
});

contextBridge.exposeInMainWorld("deckapp", {
  onOpenSession: (cb) => ipcRenderer.on("open-session", (_e, id) => cb(id)),
});
