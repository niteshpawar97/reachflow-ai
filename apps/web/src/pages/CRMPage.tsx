import { useState, type DragEvent } from 'react';
import { extractApiError } from '../lib/api';
import { useAddDealActivity, useDeal, useDeals, useUpdateDealStage } from '../features/deals/useDeals';
import type { Deal, DealStage } from '../features/deals/deals.api';

const STAGES: DealStage[] = ['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

const STAGE_LABEL: Record<DealStage, string> = {
  NEW: 'New',
  QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
};

export function CRMPage() {
  const { data: deals, isLoading } = useDeals();
  const moveStage = useUpdateDealStage();
  const [selected, setSelected] = useState<string | undefined>();
  const [dragging, setDragging] = useState<string | null>(null);

  const byStage = (stage: DealStage): Deal[] => (deals ?? []).filter((d) => d.stage === stage);

  const onDrop = (stage: DealStage) => (e: DragEvent) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('text/plain');
    if (dealId) moveStage.mutate({ id: dealId, stage });
    setDragging(null);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
        <p className="text-sm text-slate-400">
          Deals created from inbox replies. Drag a card between stages.
        </p>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((stage) => (
          <div
            key={stage}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop(stage)}
            className={`min-h-[300px] rounded-lg border p-2 ${
              dragging ? 'border-brand/50 bg-brand/5' : 'border-surface-border bg-surface'
            }`}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase text-slate-400">{STAGE_LABEL[stage]}</span>
              <span className="text-xs text-slate-500">{byStage(stage).length}</span>
            </div>
            <div className="space-y-2">
              {byStage(stage).map((deal) => (
                <div
                  key={deal.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', deal.id);
                    setDragging(deal.id);
                  }}
                  onDragEnd={() => setDragging(null)}
                  onClick={() => setSelected(deal.id)}
                  className="cursor-pointer rounded-lg border border-surface-border bg-surface-raised p-2.5 text-sm hover:border-brand/40"
                >
                  <div className="truncate font-medium text-slate-100">{deal.lead.company.name}</div>
                  <div className="truncate text-xs text-slate-500">{deal.title}</div>
                  {deal.value != null && (
                    <div className="mt-1 text-xs text-green-300">
                      {deal.currency} {deal.value}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected && <DealDrawer dealId={selected} onClose={() => setSelected(undefined)} />}
    </div>
  );
}

function DealDrawer({ dealId, onClose }: { dealId: string; onClose: () => void }) {
  const { data: deal, isLoading } = useDeal(dealId);
  const moveStage = useUpdateDealStage();
  const addActivity = useAddDealActivity(dealId);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const addNote = async (): Promise<void> => {
    if (!note.trim()) return;
    setErr(null);
    try {
      await addActivity.mutateAsync({ type: 'NOTE', body: note.trim() });
      setNote('');
    } catch (e) {
      setErr(extractApiError(e));
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-surface-border bg-surface-raised p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">{deal?.title ?? 'Deal'}</h2>
          <button className="btn-ghost py-1" onClick={onClose}>✕</button>
        </div>

        {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

        {deal && (
          <>
            <dl className="mb-4 space-y-2 text-sm">
              <Row label="Company" value={deal.lead.company.name} />
              <Row label="Contact" value={deal.lead.contact?.email} />
              <Row label="Value" value={deal.value != null ? `${deal.currency} ${deal.value}` : undefined} />
            </dl>

            <div className="mb-4">
              <label className="label">Stage</label>
              <select
                className="input"
                value={deal.stage}
                onChange={(e) => moveStage.mutate({ id: deal.id, stage: e.target.value as DealStage })}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                ))}
              </select>
            </div>

            <div className="mb-4 flex gap-2">
              <input
                className="input flex-1"
                placeholder="Add a note…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addNote()}
              />
              <button className="btn-ghost" disabled={addActivity.isPending} onClick={() => void addNote()}>
                Add
              </button>
            </div>
            {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

            <h3 className="mb-2 text-sm font-semibold">Activity</h3>
            <div className="space-y-2">
              {deal.activities.map((a) => (
                <div key={a.id} className="rounded border border-surface-border bg-surface p-2 text-xs">
                  <div className="mb-0.5 text-slate-400">
                    {a.type} · {new Date(a.createdAt).toLocaleString()}
                  </div>
                  {a.body && <div className="text-slate-200">{a.body}</div>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="truncate text-right text-slate-200">{value ?? '—'}</span>
    </div>
  );
}
