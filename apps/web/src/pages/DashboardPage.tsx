import { useAuthStore } from '../store/auth.store';
import { useActiveWorkspace, useMembers } from '../features/workspaces/useWorkspaces';

const KPIS = [
  { label: 'Emails sent', value: '—' },
  { label: 'Open rate', value: '—' },
  { label: 'Reply rate', value: '—' },
  { label: 'Meetings', value: '—' },
];

const CHECKLIST = [
  { label: 'Create your workspace', done: true },
  { label: 'Connect a mailbox', done: false, soon: 'M17' },
  { label: 'Import or find leads', done: false, soon: 'M27' },
  { label: 'Launch your first campaign', done: false, soon: 'M44' },
];

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const ws = useActiveWorkspace();
  const { data: members } = useMembers(ws?.id);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="text-sm text-slate-400">
          Workspace: <span className="text-slate-200">{ws?.name ?? '—'}</span>
          {ws?.role && (
            <span className="ml-2 rounded bg-white/5 px-1.5 py-0.5 text-[11px] uppercase text-slate-400">
              {ws.role}
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {KPIS.map((k) => (
          <div key={k.label} className="card">
            <div className="text-2xl font-semibold">{k.value}</div>
            <div className="mt-1 text-xs text-slate-400">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-medium">Getting started</h2>
          <ul className="space-y-2">
            {CHECKLIST.map((item) => (
              <li key={item.label} className="flex items-center gap-3 text-sm">
                <span
                  className={[
                    'grid h-5 w-5 place-items-center rounded-full text-[11px]',
                    item.done ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-slate-500',
                  ].join(' ')}
                >
                  {item.done ? '✓' : '•'}
                </span>
                <span className={item.done ? 'text-slate-200' : 'text-slate-400'}>
                  {item.label}
                </span>
                {item.soon && (
                  <span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                    {item.soon}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2 className="mb-3 font-medium">Team</h2>
          <ul className="space-y-2">
            {(members ?? []).map((m) => (
              <li key={m.userId} className="flex items-center justify-between text-sm">
                <span className="text-slate-200">{m.name ?? m.email}</span>
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] uppercase text-slate-400">
                  {m.role}
                </span>
              </li>
            ))}
            {members && members.length === 0 && (
              <li className="text-sm text-slate-500">No members yet.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
