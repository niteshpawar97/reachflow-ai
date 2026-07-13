import { useState } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useWorkspaceStore } from '../store/workspace.store';
import { useLogout } from '../features/auth/useAuth';
import { useCreateWorkspace, useWorkspaces } from '../features/workspaces/useWorkspaces';

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { data: workspaces } = useWorkspaces();
  const { activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore();
  const createWs = useCreateWorkspace();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const onCreate = async (): Promise<void> => {
    if (!name.trim()) return;
    await createWs.mutateAsync(name.trim());
    setName('');
    setCreating(false);
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-surface-border bg-surface px-4">
      <div className="flex items-center gap-2">
        <select
          className="input max-w-[220px] py-1.5"
          value={activeWorkspaceId ?? ''}
          onChange={(e) => setActiveWorkspace(e.target.value)}
        >
          {(workspaces ?? []).map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        {creating ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              className="input w-40 py-1.5"
              placeholder="Workspace name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void onCreate()}
            />
            <button className="btn-primary py-1.5" onClick={() => void onCreate()} disabled={createWs.isPending}>
              Add
            </button>
            <button className="btn-ghost py-1.5" onClick={() => setCreating(false)}>
              ✕
            </button>
          </div>
        ) : (
          <button className="btn-ghost py-1.5" onClick={() => setCreating(true)}>
            + New
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <div className="text-sm text-slate-200">{user?.name ?? user?.email}</div>
          <div className="text-[11px] text-slate-500">{user?.email}</div>
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-semibold text-white">
          {(user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()}
        </div>
        <button className="btn-ghost py-1.5" onClick={() => void logout()}>
          Logout
        </button>
      </div>
    </header>
  );
}
