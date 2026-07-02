function attentionKey(session) {
  if (!session || session.state === "idle") return null;
  if (session.state === "waiting" || session.state === "error") {
    return `${session.state}:${session.lastActivityAt || 0}`;
  }
  if (session.state === "working" && session.staleSince != null) {
    return `stalled:${session.staleSince}`;
  }
  return null;
}

function nextAttentionBadge(seen, sessions, openSessionId, focused) {
  const nextSeen = new Map();
  let unread = 0;

  for (const session of sessions || []) {
    const key = attentionKey(session);
    if (!key) continue;

    if (focused && openSessionId === session.id) {
      nextSeen.set(session.id, key);
      continue;
    }

    if (seen.get(session.id) === key) {
      nextSeen.set(session.id, key);
    } else {
      unread += 1;
    }
  }

  return { unread, seen: nextSeen };
}

module.exports = { attentionKey, nextAttentionBadge };
