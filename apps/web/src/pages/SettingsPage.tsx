import { useEffect, useState } from 'react';
import { extractApiError } from '../lib/api';
import {
  useActiveWorkspace,
  useRenameWorkspace,
  useUpdateSettings,
  useWorkspaceSettings,
} from '../features/workspaces/useWorkspaces';
import {
  useAddSuppression,
  useRemoveSuppression,
  useSuppressions,
} from '../features/suppressions/useSuppressions';

export function SettingsPage() {
  const ws = useActiveWorkspace();
  const { data: settings } = useWorkspaceSettings(ws?.id);
  const rename = useRenameWorkspace(ws?.id ?? '');
  const updateSettings = useUpdateSettings(ws?.id ?? '');

  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [address, setAddress] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isAdmin = ws?.role === 'ADMIN';

  useEffect(() => setName(ws?.name ?? ''), [ws?.name]);
  useEffect(() => {
    if (settings) {
      setTimezone(settings.timezone ?? 'UTC');
      const compliance = settings.compliance as { address?: string } | null;
      setAddress(compliance?.address ?? '');
    }
  }, [settings]);

  const save = async (): Promise<void> => {
    setMsg(null);
    setErr(null);
    try {
      if (name && name !== ws?.name) await rename.mutateAsync(name);
      await updateSettings.mutateAsync({ timezone, compliance: { address } });
      setMsg('Saved');
    } catch (e) {
      setErr(extractApiError(e));
    }
  };

  if (!ws) return <p className="text-slate-400">No workspace selected.</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Workspace settings</h1>

      <div className="card space-y-4">
        <div>
          <label className="label">Workspace name</label>
          <input
            className="input"
            value={name}
            disabled={!isAdmin}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Default timezone</label>
          <input
            className="input"
            value={timezone}
            disabled={!isAdmin}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="e.g. Asia/Dubai"
          />
        </div>
        <div>
          <label className="label">Compliance mailing address</label>
          <input
            className="input"
            value={address}
            disabled={!isAdmin}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Physical address for email footer (CAN-SPAM / GDPR)"
          />
          <p className="mt-1 text-xs text-slate-500">
            Required in outbound email footers for legal compliance.
          </p>
        </div>

        {msg && <p className="text-sm text-green-400">{msg}</p>}
        {err && <p className="text-sm text-red-400">{err}</p>}

        {isAdmin ? (
          <button
            className="btn-primary"
            onClick={() => void save()}
            disabled={rename.isPending || updateSettings.isPending}
          >
            {rename.isPending || updateSettings.isPending ? 'Saving…' : 'Save changes'}
          </button>
        ) : (
          <p className="text-xs text-slate-500">Only workspace admins can edit settings.</p>
        )}
      </div>

      <div className="card">
        <div className="text-xs text-slate-500">Workspace ID</div>
        <div className="font-mono text-sm text-slate-300">{ws.id}</div>
        <div className="mt-2 text-xs text-slate-500">Slug</div>
        <div className="font-mono text-sm text-slate-300">{ws.slug}</div>
      </div>

      <SuppressionCard />
    </div>
  );
}

function SuppressionCard() {
  const { data: suppressions, isLoading } = useSuppressions();
  const add = useAddSuppression();
  const remove = useRemoveSuppression();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setErr(null);
    try {
      await add.mutateAsync({ email: email.trim() });
      setEmail('');
    } catch (e2) {
      setErr(extractApiError(e2));
    }
  };

  const reasonClass = (r: string): string =>
    r === 'UNSUBSCRIBED'
      ? 'bg-amber-500/15 text-amber-300'
      : r === 'BOUNCED'
        ? 'bg-red-500/15 text-red-300'
        : r === 'COMPLAINED'
          ? 'bg-red-500/20 text-red-300'
          : 'bg-white/10 text-slate-300';

  return (
    <div className="card">
      <h2 className="mb-1 font-medium">Suppression list</h2>
      <p className="mb-3 text-xs text-slate-500">
        These addresses are never sent to — unsubscribed, bounced, or manually blocked.
      </p>

      <form onSubmit={(e) => void submit(e)} className="mb-3 flex gap-2">
        <input
          className="input flex-1"
          type="email"
          required
          placeholder="Add an email to block"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn-ghost" disabled={add.isPending}>
          {add.isPending ? 'Adding…' : 'Block'}
        </button>
      </form>
      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && !suppressions?.length && (
        <p className="text-sm text-slate-500">No suppressed addresses yet.</p>
      )}

      <div className="max-h-72 space-y-1 overflow-y-auto">
        {suppressions?.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-white/5"
          >
            <div className="min-w-0">
              <div className="truncate text-slate-200">{s.email}</div>
              <div className="text-[11px] text-slate-500">
                {new Date(s.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] ${reasonClass(s.reason)}`}>
                {s.reason}
              </span>
              <button
                className="text-xs text-red-300 hover:underline"
                onClick={() => remove.mutate(s.id)}
              >
                remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
