import { useEffect, useRef, useState } from "react";

// A focused inline text field for renaming a terminal. Used instead of
// window.prompt(), which Electron's Chromium refuses to implement (it silently
// no-ops, so the desktop app could never rename). Enter commits, Escape and
// blur cancel/commit; it fires exactly once even though Enter also triggers a
// blur as the field unmounts.
export function InlineRename({
  value,
  className,
  onSubmit,
  onCancel,
}: {
  value: string;
  className?: string;
  onSubmit: (next: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  function finish(action: () => void) {
    if (done.current) return;
    done.current = true;
    action();
  }

  function commit() {
    const next = draft.trim();
    if (next && next !== value) finish(() => onSubmit(next));
    else finish(onCancel);
  }

  return (
    <input
      ref={ref}
      className={className}
      value={draft}
      maxLength={80}
      aria-label="Rename terminal"
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(onCancel);
        }
      }}
    />
  );
}
