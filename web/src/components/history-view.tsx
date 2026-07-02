import { useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { deleteHistory, getHistory, resumeSession } from "../api";
import type { ArchivedSession } from "../types";
import { historyRowModel } from "./history-data";

export function HistoryView({ onResumed }: { onResumed: (id: string) => void }) {
  const [rows, setRows] = useState<ArchivedSession[]>([]);

  function refresh() {
    getHistory().then(setRows);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onResume(id: string) {
    const res = await resumeSession(id);
    if (res.ok && res.id) {
      onResumed(res.id);
      return;
    }
    refresh();
  }

  async function onDelete(id: string) {
    await deleteHistory(id);
    refresh();
  }

  return (
    <>
      <header className="main__bar">
        <div>
          <h1 className="main__title">History</h1>
          <p className="main__sub">{rows.length} ended · resume or clear</p>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="empty">
          <p className="muted">Nothing ended yet.</p>
        </div>
      ) : (
        <main className="deck history-list">
          {rows.map((row) => {
            const model = historyRowModel(row);
            return (
              <div key={row.id} className="history-row" data-unexpected={row.unexpected}>
                <span className="history-row__title">{row.title}</span>
                <span className="history-row__meta">
                  {row.agent} · {model.stateLabel} · {model.endedLabel}
                </span>
                <span className="history-row__actions">
                  {model.resumable ? (
                    <button type="button" title="Resume" aria-label={`Resume ${row.title}`} onClick={() => onResume(row.id)}>
                      <RotateCcw size={14} strokeWidth={1.75} />
                    </button>
                  ) : null}
                  <button type="button" title="Delete" aria-label={`Delete ${row.title}`} onClick={() => onDelete(row.id)}>
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </span>
              </div>
            );
          })}
        </main>
      )}
    </>
  );
}
