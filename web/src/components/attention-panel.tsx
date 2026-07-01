import type { AttentionItem, AttentionKind } from "../attention";

const LABEL: Record<AttentionKind, { icon: string; text: string }> = {
  waiting: { icon: "🙋", text: "Needs you" },
  error: { icon: "😵", text: "Errored" },
  stalled: { icon: "🐌", text: "Stalled" },
};

export function AttentionPanel({
  items,
  onOpen,
}: {
  items: AttentionItem[];
  onOpen: (id: string) => void;
}) {
  if (items.length === 0) {
    return <div className="attention attention--calm">All steady — you can walk away.</div>;
  }
  return (
    <div className="attention">
      <div className="attention__head">
        {items.length} need{items.length === 1 ? "s" : ""} your attention
      </div>
      <ul className="attention__list">
        {items.map(({ session, kind }) => (
          <li key={session.id}>
            <button className="attention__item" data-kind={kind} onClick={() => onOpen(session.id)}>
              <span className="attention__icon" aria-hidden>{LABEL[kind].icon}</span>
              <span className="attention__title">{session.title}</span>
              <span className="attention__kind">{LABEL[kind].text}</span>
              <span className="attention__summary">{session.lastSummaryLine}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
