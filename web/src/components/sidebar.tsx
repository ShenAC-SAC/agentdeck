export interface NavItem {
  key: string;
  label: string;
  total: number;
  waiting: number;
}

export function Sidebar({
  items,
  active,
  onSelect,
}: {
  items: NavItem[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <nav className="sidebar">
      <div className="sidebar__brand">
        <span className="brand__mark">⚓</span>
        <span className="sidebar__title">AgentDeck</span>
      </div>
      <ul className="sidebar__list">
        {items.map((it) => (
          <li key={it.key}>
            <button
              type="button"
              className="nav-item"
              data-active={it.key === active}
              onClick={() => onSelect(it.key)}
            >
              <span className="nav-item__label">{it.label}</span>
              <span className="nav-item__meta">
                {it.waiting > 0 ? <span className="nav-item__badge">{it.waiting}</span> : null}
                <span className="nav-item__count">{it.total}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="sidebar__foot">local · tmux -L deck</div>
    </nav>
  );
}
