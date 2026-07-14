import { NavLink } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  soon?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '▤', end: true },
  { to: '/leads', label: 'Leads', icon: '◈' },
  { to: '/campaigns', label: 'Campaigns', icon: '✉' },
  { to: '/mailboxes', label: 'Mailboxes', icon: '✱' },
  { to: '/inbox', label: 'Inbox', icon: '⌂' },
  { to: '/crm', label: 'CRM', icon: '⇄' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-surface-border bg-surface-raised md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-surface-border px-4">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-sm font-bold text-white">
          R
        </span>
        <span className="font-semibold tracking-tight">ReachFlow</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                item.soon
                  ? 'cursor-default text-slate-500'
                  : isActive
                    ? 'bg-brand/15 text-white'
                    : 'text-slate-300 hover:bg-white/5',
              ].join(' ')
            }
            onClick={(e) => item.soon && e.preventDefault()}
          >
            <span className="flex items-center gap-3">
              <span className="text-slate-400">{item.icon}</span>
              {item.label}
            </span>
            {item.soon && (
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                soon
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-surface-border p-3 text-[11px] text-slate-500">
        v0.1 · internal
      </div>
    </aside>
  );
}
