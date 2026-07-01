import { Box, Text } from "ink";
import type { Session } from "../types";
import { moodFor, MOOD_FACE } from "./mood";

export function CrewMember({ session, selected }: { session: Session; selected: boolean }) {
  const face = MOOD_FACE[moodFor(session.state)];
  const color = session.state === "waiting" ? "yellow" : session.state === "error" ? "red" : undefined;
  return (
    <Box>
      <Text inverse={selected} color={color}>
        {face} {session.title} · {session.state} · {session.lastSummaryLine}
      </Text>
    </Box>
  );
}
