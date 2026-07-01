import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { EventEmitter } from "node:events";
import type { Registry } from "../hub/registry";
import { tmux } from "../tmux/tmux";
import { CrewMember } from "./crew-member";

export function DeckView({ registry, events }: { registry: Registry; events: EventEmitter }) {
  const [, force] = useState(0);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const onUpdate = () => force((x) => x + 1);
    events.on("update", onUpdate);
    return () => {
      events.off("update", onUpdate);
    };
  }, [events]);

  const list = registry.list();

  useInput((_input, key) => {
    if (key.downArrow) setSel((s) => Math.min(s + 1, list.length - 1));
    if (key.upArrow) setSel((s) => Math.max(s - 1, 0));
    if (key.return && list[sel]) tmux.switchClient(list[sel].tmuxTarget); // jump to the right pane
  });

  return (
    <Box flexDirection="column">
      <Text bold>⚓ AgentDeck — deck (↑↓ select, Enter jump)</Text>
      {list.map((s, i) => (
        <CrewMember key={s.id} session={s} selected={i === sel} />
      ))}
    </Box>
  );
}
