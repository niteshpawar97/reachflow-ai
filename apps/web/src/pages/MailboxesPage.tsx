import { useState } from 'react';
import { extractApiError } from '../lib/api';
import {
  useCheckDomainAuth,
  useCreateMailbox,
  useDeleteMailbox,
  useMailboxes,
  useReactivateMailbox,
  useTestMailbox,
  useUpdateMailbox,
} from '../features/mailboxes/useMailboxes';
import type { DomainAuthReport, Mailbox } from '../features/mailboxes/mailboxes.api';

export function MailboxesPage() {
  const { data: mailboxes, isLoading } = useMailboxes();
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mailboxes</h1>
          <p className="text-sm text-slate-500">
            Sending identities. Credentials are encrypted at rest and never shown again.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Close' : '+ Add SMTP mailbox'}
        </button>
      </div>

      {adding && <AddMailboxForm onDone={() => setAdding(false)} />}

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && !mailboxes?.length && (
        <p className="text-sm text-slate-500">
          No mailboxes yet. Add an SMTP mailbox to start sending. (Gmail / Microsoft 365 via OAuth
          coming soon.)
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {mailboxes?.map((m) => (
          <MailboxCard key={m.id} mailbox={m} />
        ))}
      </div>
    </div>
  );
}

function MailboxCard({ mailbox }: { mailbox: Mailbox }) {
  const del = useDeleteMailbox();
  const test = useTestMailbox();
  const update = useUpdateMailbox();
  const domainAuth = useCheckDomainAuth();
  const reactivate = useReactivateMailbox();
  const [note, setNote] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const sendTest = async (): Promise<void> => {
    setNote(null);
    try {
      const r = await test.mutateAsync({ id: mailbox.id });
      setNote(`✓ Sent (id ${r.messageId.slice(0, 16)}…)`);
    } catch (e) {
      setNote(`✕ ${extractApiError(e)}`);
    }
  };

  const runDomainAuth = async (): Promise<void> => {
    setNote(null);
    setShowReport(true);
    try {
      await domainAuth.mutateAsync(mailbox.id);
    } catch (e) {
      setNote(`✕ ${extractApiError(e)}`);
    }
  };

  const statusClass =
    mailbox.status === 'ACTIVE'
      ? 'bg-green-500/20 text-green-300'
      : mailbox.status === 'ERROR'
        ? 'bg-red-500/20 text-red-300'
        : mailbox.status === 'PAUSED'
          ? 'bg-amber-500/20 text-amber-300'
          : 'bg-slate-500/20 text-slate-300';

  const healthClass =
    mailbox.healthScore >= 80
      ? 'text-green-300'
      : mailbox.healthScore >= 50
        ? 'text-amber-300'
        : 'text-red-400';

  return (
    <div className="rounded-lg border border-surface-border bg-surface-raised p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-100">{mailbox.email}</div>
          <div className="text-xs text-slate-500">
            {mailbox.displayName ?? '—'} · {mailbox.provider}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${healthClass}`} title="Health score">
            {mailbox.healthScore}
          </span>
          <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${statusClass}`}>
            {mailbox.status}
          </span>
        </div>
      </div>
      <dl className="space-y-1 text-xs text-slate-400">
        {mailbox.smtpHost && (
          <div>
            SMTP: {mailbox.smtpHost}:{mailbox.smtpPort} {mailbox.smtpSecure ? '(TLS)' : ''}
          </div>
        )}
        <div>
          Daily: {mailbox.sentToday}/{mailbox.dailyLimit}
          {mailbox.warmupEnabled && mailbox.warmupStartedAt && (
            <span className="text-amber-300"> · warming up</span>
          )}
        </div>
        <div>
          Sent {mailbox.sentTotal} total · {mailbox.bounceCount} bounced
        </div>
        {mailbox.autoPausedAt && (
          <div className="text-amber-300">Auto-paused — health score dropped too low.</div>
        )}
        {mailbox.lastError && <div className="text-red-400">{mailbox.lastError}</div>}
      </dl>
      {note && <p className="mt-2 text-xs text-slate-400">{note}</p>}
      {showReport && <DomainAuthPanel report={domainAuth.data ?? mailbox.domainAuthReport} loading={domainAuth.isPending} />}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <label className="flex items-center gap-1.5 pr-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={mailbox.warmupEnabled}
            disabled={update.isPending}
            onChange={(e) => update.mutate({ id: mailbox.id, warmupEnabled: e.target.checked })}
          />
          Warmup
        </label>
        <button
          className="btn-ghost py-1 text-xs"
          disabled={domainAuth.isPending}
          onClick={() => void runDomainAuth()}
        >
          {domainAuth.isPending ? 'Checking…' : 'Check domain auth'}
        </button>
        <button
          className="btn-ghost py-1 text-xs"
          disabled={test.isPending}
          onClick={() => void sendTest()}
        >
          {test.isPending ? 'Sending…' : 'Send test'}
        </button>
        {mailbox.status === 'PAUSED' && (
          <button
            className="btn-ghost py-1 text-xs text-amber-300"
            disabled={reactivate.isPending}
            onClick={() => reactivate.mutate(mailbox.id)}
          >
            Reactivate
          </button>
        )}
        <button
          className="btn-ghost py-1 text-xs text-red-400"
          disabled={del.isPending}
          onClick={() => {
            if (confirm(`Remove ${mailbox.email}?`)) del.mutate(mailbox.id);
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function DomainAuthPanel({ report, loading }: { report?: DomainAuthReport | null; loading: boolean }) {
  if (loading) return <p className="mt-2 text-xs text-slate-500">Running DNS checks…</p>;
  if (!report) return null;

  const rows: Array<[string, { pass: boolean; detail: string }]> = [
    ['MX', report.mx],
    ['SPF', report.spf],
    ['DMARC', report.dmarc],
    ['DKIM', report.dkim],
  ];

  return (
    <div className="mt-2 space-y-1 rounded border border-surface-border bg-black/20 p-2 text-[11px]">
      <div className="mb-1 text-slate-400">Domain: {report.domain}</div>
      {rows.map(([label, check]) => (
        <div key={label} className="flex items-start gap-2">
          <span className={check.pass ? 'text-green-400' : 'text-red-400'}>{check.pass ? '✓' : '✕'}</span>
          <span className="font-medium text-slate-300">{label}:</span>
          <span className="text-slate-500">{check.detail}</span>
        </div>
      ))}
    </div>
  );
}

function AddMailboxForm({ onDone }: { onDone: () => void }) {
  const create = useCreateMailbox();
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    smtpHost: '',
    smtpPort: '587',
    smtpSecure: true,
    smtpUsername: '',
    smtpPassword: '',
    dailyLimit: '50',
  });

  const set = (k: keyof typeof form, v: string | boolean): void =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setErr(null);
    try {
      await create.mutateAsync({
        provider: 'SMTP',
        email: form.email,
        displayName: form.displayName || undefined,
        smtpHost: form.smtpHost,
        smtpPort: Number(form.smtpPort),
        smtpSecure: form.smtpSecure,
        smtpUsername: form.smtpUsername || form.email,
        smtpPassword: form.smtpPassword,
        dailyLimit: Number(form.dailyLimit),
      });
      onDone();
    } catch (e2) {
      setErr(extractApiError(e2));
    }
  };

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="mb-6 grid gap-3 rounded-lg border border-surface-border bg-surface-raised p-4 sm:grid-cols-2"
    >
      <div>
        <label className="label">From email</label>
        <input
          className="input"
          type="email"
          required
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
        />
      </div>
      <div>
        <label className="label">Display name</label>
        <input className="input" value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
      </div>
      <div>
        <label className="label">SMTP host</label>
        <input
          className="input"
          required
          placeholder="smtp.gmail.com"
          value={form.smtpHost}
          onChange={(e) => set('smtpHost', e.target.value)}
        />
      </div>
      <div>
        <label className="label">Port</label>
        <input
          className="input"
          type="number"
          required
          value={form.smtpPort}
          onChange={(e) => set('smtpPort', e.target.value)}
        />
      </div>
      <div>
        <label className="label">Username</label>
        <input
          className="input"
          placeholder="(defaults to email)"
          value={form.smtpUsername}
          onChange={(e) => set('smtpUsername', e.target.value)}
        />
      </div>
      <div>
        <label className="label">Password / app password</label>
        <input
          className="input"
          type="password"
          required
          value={form.smtpPassword}
          onChange={(e) => set('smtpPassword', e.target.value)}
        />
      </div>
      <div>
        <label className="label">Daily send limit</label>
        <input
          className="input"
          type="number"
          value={form.dailyLimit}
          onChange={(e) => set('dailyLimit', e.target.value)}
        />
      </div>
      <label className="flex items-end gap-2 pb-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={form.smtpSecure}
          onChange={(e) => set('smtpSecure', e.target.checked)}
        />
        Use TLS
      </label>

      {err && <p className="text-sm text-red-400 sm:col-span-2">{err}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn-primary" disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Save mailbox'}
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
