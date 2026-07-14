import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useActiveWorkspace, useMembers } from '../features/workspaces/useWorkspaces';
import { useDashboardStats } from '../features/dashboard/useDashboard';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const ws = useActiveWorkspace();
  const { data: members } = useMembers(ws?.id);
  const { data: stats, isLoading } = useDashboardStats();

  const e = stats?.emails;
  const kpis = [
    { label: 'Emails sent', value: e ? String(e.sent) : '—' },
    { label: 'Open rate', value: e && e.sent > 0 ? `${e.openRate}%` : '—' },
    { label: 'Reply rate', value: e && e.sent > 0 ? `${e.replyRate}%` : '—' },
    { label: 'Click rate', value: e && e.sent > 0 ? `${e.clickRate}%` : '—' },
  ];

  const counts = [
    { label: 'Leads', value: stats?.leads.total ?? 0, sub: `${stats?.leads.verified ?? 0} verified`, to: '/leads' },
    { label: 'Mailboxes', value: stats?.mailboxes ?? 0, sub: 'sending identities', to: '/mailboxes' },
    { label: 'Campaigns', value: stats?.campaigns.total ?? 0, sub: `${stats?.campaigns.active ?? 0} active`, to: '/campaigns' },
    { label: 'AI emails', value: stats?.emails.generated ?? 0, sub: 'drafts generated', to: '/leads' },
  ];

  const checklist = [
    { label: 'Create your workspace', done: true, to: '/settings' },
    { label: 'Connect a mailbox', done: stats?.checklist.mailbox ?? false, to: '/mailboxes' },
    { label: 'Import or find leads', done: stats?.checklist.leads ?? false, to: '/leads' },
    { label: 'Launch your first campaign', done: stats?.checklist.campaign ?? false, to: '/campaigns' },
  ];

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

      {/* Outreach KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card">
            <div className="text-2xl font-semibold">{isLoading ? '…' : k.value}</div>
            <div className="mt-1 text-xs text-slate-400">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Pipeline counts (clickable) */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {counts.map((c) => (
          <Link key={c.label} to={c.to} className="card transition hover:bg-white/5">
            <div className="text-2xl font-semibold">{isLoading ? '…' : c.value}</div>
            <div className="mt-1 text-xs text-slate-400">{c.label}</div>
            <div className="text-[11px] text-slate-500">{c.sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-medium">Getting started</h2>
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-3 text-sm">
                <span
                  className={[
                    'grid h-5 w-5 place-items-center rounded-full text-[11px]',
                    item.done ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-slate-500',
                  ].join(' ')}
                >
                  {item.done ? '✓' : '•'}
                </span>
                <span className={item.done ? 'text-slate-200' : 'text-slate-400'}>{item.label}</span>
                {!item.done && (
                  <Link to={item.to} className="ml-auto text-[11px] text-brand hover:underline">
                    Do it →
                  </Link>
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
