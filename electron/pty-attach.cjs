const os = require("node:os");
const path = require("node:path");

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function controlPath(host) {
  const safe = String(host).replace(/[^A-Za-z0-9_.-]/g, "_");
  return path.join(os.tmpdir(), `deck-ssh-${safe}.sock`);
}

function ptyAttachCommand(host, target) {
  const session = String(target || "").split(":")[0];
  if (host && host !== "local") {
    const remoteCommand = `tmux -L deck attach -t ${shQuote(session)}`;
    return `exec ssh -tt -o ${shQuote(`ControlPath=${controlPath(host)}`)} ${shQuote(host)} ${shQuote(remoteCommand)}`;
  }
  return `tmux -L deck set -g status off 2>/dev/null; exec tmux -L deck attach -t ${shQuote(session)}`;
}

module.exports = { controlPath, ptyAttachCommand, shQuote };
