import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { extractApiError } from '../lib/api';
import { useLeads } from '../features/leads/useLeads';
import type { LeadStatus } from '../features/leads/leads.api';
import {
  addCampaignStep,
  attachCampaignLeads,
  launchCampaign,
  pauseCampaign,
  resumeCampaign,
  stopCampaign,
} from '../features/campaigns/campaigns.api';
import {
  useCampaign,
  useCampaigns,
  useCreateCampaign,
} from '../features/campaigns/useCampaigns';
import type { CampaignStepMode, CampaignStepTrigger } from '../features/campaigns/campaigns.api';
import { useQueryClient } from '@tanstack/react-query';

type DraftStep = {
  position: number;
  mode: CampaignStepMode;
  trigger: CampaignStepTrigger;
  delayMinutes: number;
  subject: string;
  body: string;
  aiPrompt: string;
};

const DEFAULT_STEP: DraftStep = {
  position: 1,
  mode: 'AI',
  trigger: 'SEND',
  delayMinutes: 0,
  subject: '',
  body: '',
  aiPrompt: 'Write a short, grounded follow-up for this lead using the campaign offer.',
};

export function CampaignsPage() {
  const { data: campaigns } = useCampaigns();
  const [leadStatusFilter, setLeadStatusFilter] = useState<LeadStatus | ''>('READY');
  const [leadSearch, setLeadSearch] = useState('');
  const { data: leadsData } = useLeads({
    status: leadStatusFilter || undefined,
    q: leadSearch.trim() || undefined,
  });
  const qc = useQueryClient();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | undefined>();

  const selectedCampaign = useCampaign(selectedCampaignId);
  const createCampaign = useCreateCampaign();

  const [name, setName] = useState('');
  const [offer, setOffer] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [dailyCap, setDailyCap] = useState(50);
  const [mailboxes, setMailboxes] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [steps, setSteps] = useState<DraftStep[]>([{ ...DEFAULT_STEP }]);
  const [error, setError] = useState<string | null>(null);
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(null);

  const readyLeads = useMemo(() => leadsData?.data ?? [], [leadsData]);
  const verifiedCount = useMemo(
    () => readyLeads.filter((lead) => lead.contact?.emailStatus === 'VALID').length,
    [readyLeads],
  );
  const readyCount = useMemo(
    () => readyLeads.filter((lead) => lead.status === 'READY' && lead.contact?.emailStatus === 'VALID').length,
    [readyLeads],
  );

  const toggleLead = (id: string) => {
    setSelectedLeadIds((current) =>
      current.includes(id) ? current.filter((leadId) => leadId !== id) : [...current, id],
    );
  };

  const patchStep = (index: number, patch: Partial<DraftStep>) => {
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  };

  const addDraftStep = () => {
    setSteps((current) => [
      ...current,
      {
        ...DEFAULT_STEP,
        position: current.length + 1,
      },
    ]);
  };

  const createAndLaunch = async (launchNow: boolean): Promise<void> => {
    setError(null);
    try {
      const campaign = await createCampaign.mutateAsync({
        name: name.trim(),
        offer: offer.trim(),
        timezone: timezone.trim() || 'UTC',
        dailyCap,
        mailboxPool: mailboxes
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map((email) => ({ email, healthy: true })),
        schedule: { mode: 'manual' },
      });

      setSavedCampaignId(campaign.id);
      setSelectedCampaignId(campaign.id);

      for (const step of steps) {
        await addCampaignStep(campaign.id, {
          position: step.position,
          mode: step.mode,
          trigger: step.trigger,
          delayMinutes: step.delayMinutes,
          subject: step.subject || undefined,
          body: step.body || undefined,
          aiPrompt: step.aiPrompt || undefined,
        });
      }

      const attachmentPayload =
        selectedLeadIds.length > 0
          ? { leadIds: selectedLeadIds }
          : { filter: { status: leadStatusFilter || undefined, q: leadSearch.trim() || undefined } };
      await attachCampaignLeads(campaign.id, attachmentPayload);

      if (launchNow) {
        await launchCampaign(campaign.id);
      }

      await qc.invalidateQueries({ queryKey: ['campaigns'] });
      await qc.invalidateQueries({ queryKey: ['campaign', undefined, campaign.id] });
    } catch (e) {
      setError(extractApiError(e));
    }
  };

  const activeCampaign = selectedCampaign.data ?? campaigns?.[0];

  return (
    <div className="mx-auto flex max-w-7xl gap-4">
      <div className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-slate-400">Build a sequence, attach leads, then launch only when validation passes.</p>
        </div>

        <div className="space-y-3 rounded-xl border border-surface-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-slate-200">Existing campaigns</h2>
          {campaigns?.length ? (
            campaigns.map((campaign) => (
              <button
                key={campaign.id}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  selectedCampaignId === campaign.id
                    ? 'border-brand bg-brand/10'
                    : 'border-surface-border bg-white/0 hover:bg-white/5'
                }`}
                onClick={() => setSelectedCampaignId(campaign.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-100">{campaign.name}</div>
                  <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
                    {campaign.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {campaign.leadCount} leads · {campaign.stepCount} steps · cap {campaign.dailyCap}/day
                </div>
              </button>
            ))
          ) : (
            <p className="text-sm text-slate-500">No campaigns yet.</p>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-4">
        <section className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Builder</h2>
            <p className="text-sm text-slate-400">Create a campaign, pick an audience, define the sequence, and validate launch.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Campaign name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cold outreach Q3" />
            </Field>
            <Field label="Timezone">
              <input className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="UTC" />
            </Field>
            <Field label="Offer / service being sold">
              <textarea className="input h-28" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="We build custom websites and AI automation..." />
            </Field>
            <Field label="Daily cap">
              <input className="input" type="number" min={1} max={500} value={dailyCap} onChange={(e) => setDailyCap(Number(e.target.value))} />
            </Field>
            <Field label="Mailbox pool (comma-separated emails)">
              <textarea className="input h-28" value={mailboxes} onChange={(e) => setMailboxes(e.target.value)} placeholder="ops@company.com, sales@company.com" />
            </Field>
            <Field label="Launch mode">
              <div className="rounded-lg border border-surface-border bg-white/5 p-3 text-sm text-slate-400">
                Validation blocks launch if you have no healthy mailbox, invalid leads, or incomplete steps.
              </div>
            </Field>
          </div>

          <div className="space-y-2 border-t border-surface-border pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Audience</h3>
              <span className="text-xs text-slate-500">
                {selectedLeadIds.length} selected · {readyCount} ready · {verifiedCount} verified
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                className="input w-56"
                placeholder="Search company / email"
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
              />
              <select
                className="input w-44"
                value={leadStatusFilter}
                onChange={(e) => setLeadStatusFilter(e.target.value as LeadStatus | '')}
              >
                <option value="">All statuses</option>
                <option value="READY">READY</option>
                <option value="SCORED">SCORED</option>
                <option value="ENRICHING">ENRICHING</option>
                <option value="NEW">NEW</option>
                <option value="IN_CAMPAIGN">IN_CAMPAIGN</option>
                <option value="REPLIED">REPLIED</option>
                <option value="WON">WON</option>
                <option value="LOST">LOST</option>
                <option value="SUPPRESSED">SUPPRESSED</option>
              </select>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {readyLeads.map((lead) => (
                <button
                  key={lead.id}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    selectedLeadIds.includes(lead.id)
                      ? 'border-brand bg-brand/10'
                      : 'border-surface-border bg-white/0 hover:bg-white/5'
                  }`}
                  onClick={() => toggleLead(lead.id)}
                >
                  <div className="font-medium text-slate-100">{lead.company.name}</div>
                  <div className="text-xs text-slate-500">{lead.contact?.email ?? 'No email'}</div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {lead.status} · {lead.contact?.emailStatus ?? 'UNKNOWN'}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                className="btn-ghost py-1 text-xs"
                onClick={() => setSelectedLeadIds(readyLeads.map((lead) => lead.id))}
              >
                Select all filtered
              </button>
              <button className="btn-ghost py-1 text-xs" onClick={() => setSelectedLeadIds([])}>
                Clear selection
              </button>
            </div>
          </div>

          <div className="space-y-3 border-t border-surface-border pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Sequence</h3>
              <button className="btn-ghost py-1 text-xs" onClick={addDraftStep}>+ Add step</button>
            </div>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={index} className="rounded-lg border border-surface-border bg-white/5 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs uppercase text-slate-500">Step {step.position}</span>
                    {steps.length > 1 && (
                      <button className="text-xs text-red-300 hover:underline" onClick={() => setSteps((current) => current.filter((_, i) => i !== index).map((item, i) => ({ ...item, position: i + 1 })))}>
                        remove
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Mode">
                      <select className="input" value={step.mode} onChange={(e: ChangeEvent<HTMLSelectElement>) => patchStep(index, { mode: e.target.value as CampaignStepMode })}>
                        <option value="AI">AI</option>
                        <option value="FIXED">FIXED</option>
                      </select>
                    </Field>
                    <Field label="Trigger">
                      <select className="input" value={step.trigger} onChange={(e: ChangeEvent<HTMLSelectElement>) => patchStep(index, { trigger: e.target.value as CampaignStepTrigger })}>
                        <option value="SEND">SEND</option>
                        <option value="NO_REPLY">NO_REPLY</option>
                        <option value="OPENED">OPENED</option>
                        <option value="CLICKED">CLICKED</option>
                        <option value="REPLIED">REPLIED</option>
                      </select>
                    </Field>
                    <Field label="Delay minutes">
                      <input className="input" type="number" min={0} value={step.delayMinutes} onChange={(e) => patchStep(index, { delayMinutes: Number(e.target.value) })} />
                    </Field>
                    <Field label="Subject">
                      <input className="input" value={step.subject} onChange={(e) => patchStep(index, { subject: e.target.value })} />
                    </Field>
                    <Field label="Body">
                      <textarea className="input h-24" value={step.body} onChange={(e) => patchStep(index, { body: e.target.value })} />
                    </Field>
                    <Field label="AI prompt">
                      <textarea className="input h-24" value={step.aiPrompt} onChange={(e) => patchStep(index, { aiPrompt: e.target.value })} />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

          <div className="flex flex-wrap gap-2 border-t border-surface-border pt-4">
            <button className="btn-primary" disabled={createCampaign.isPending} onClick={() => void createAndLaunch(false)}>
              {createCampaign.isPending ? 'Saving…' : 'Save draft'}
            </button>
            <button className="btn-ghost" disabled={createCampaign.isPending} onClick={() => void createAndLaunch(true)}>
              Save + launch
            </button>
          </div>

          {savedCampaignId && <p className="text-xs text-slate-500">Saved campaign id: {savedCampaignId}</p>}
        </section>

        <section className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Review</h2>
              <p className="text-sm text-slate-400">Validate and manage the currently selected campaign.</p>
            </div>
            {activeCampaign && (
              <div className="flex gap-2">
                <button className="btn-ghost py-1 text-xs" onClick={() => void pauseCampaign(activeCampaign.id)}>Pause</button>
                <button className="btn-ghost py-1 text-xs" onClick={() => void resumeCampaign(activeCampaign.id)}>Resume</button>
                <button className="btn-ghost py-1 text-xs text-red-300" onClick={() => void stopCampaign(activeCampaign.id)}>Stop</button>
                <button className="btn-primary py-1 text-xs" onClick={() => void launchCampaign(activeCampaign.id)}>Launch</button>
              </div>
            )}
          </div>

          {activeCampaign ? (
            <div className="grid gap-3 md:grid-cols-3">
              <Stat label="Status" value={activeCampaign.status} />
              <Stat label="Leads" value={String(activeCampaign.leadCount)} />
              <Stat label="Steps" value={String(activeCampaign.stepCount)} />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select or create a campaign to review it here.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-white/5 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}
