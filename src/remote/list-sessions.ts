import { FIELDS } from "./ingest";
import { shQuote } from "./ssh";

const NO_TMUX_SERVER_PATTERN = "no server running|error connecting to .*deck .*No such file or directory";

export function remoteListSessionsCommand(fields: string = FIELDS): string {
  return [
    `out="$(tmux -L deck list-sessions -F ${shQuote(fields)} 2>&1)"`,
    "code=$?",
    'if [ "$code" -eq 0 ]; then printf \'%s\' "$out"; exit 0; fi',
    `if printf '%s' "$out" | grep -Eiq ${shQuote(NO_TMUX_SERVER_PATTERN)}; then exit 0; fi`,
    'printf \'%s\' "$out" >&2',
    'exit "$code"',
  ].join("; ");
}
