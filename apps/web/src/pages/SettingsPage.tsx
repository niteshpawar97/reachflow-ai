import { useEffect, useState } from 'react';
import { extractApiError } from '../lib/api';
import {
  useActiveWorkspace,
  useRenameWorkspace,
  useUpdateSettings,
  useWorkspaceSettings,
} from '../features/workspaces/useWorkspaces';

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
    </div>
  );
}
