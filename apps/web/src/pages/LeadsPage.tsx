import { useState, type ReactNode } from 'react';
import { extractApiError } from '../lib/api';
import type { EmailDraft, ImportResult, Lead, LeadStatus } from '../features/leads/leads.api';
import {
  useApproveLeadEmail,
  useCreateLead,
  useDeleteLead,
  useGenerateEmail,
  useGenerateFollowUp,
  useGenerateVariants,
  useImportLeads,
  useLeadAudit,
  useLeadEmails,
  useLeads,
  useRejectLeadEmail,
  useRunAudit,
  useScrapeContacts,
  useSummarizeAudit,
  useUpdateLeadStatus,
} from '../features/leads/useLeads';

const STATUSES: LeadStatus[] = [
  'NEW',
  'ENRICHING',
  'SCORED',
  'READY',
  'IN_CAMPAIGN',
  'REPLIED',
  'WON',
  'LOST',
  'SUPPRESSED',
];

const STATUS_COLOR: Record<string, string> = {
  NEW: 'bg-slate-500/20 text-slate-300',
  READY: 'bg-blue-500/20 text-blue-300',
  IN_CAMPAIGN: 'bg-indigo-500/20 text-indigo-300',
  REPLIED: 'bg-amber-500/20 text-amber-300',
  WON: 'bg-green-500/20 text-green-300',
  LOST: 'bg-red-500/20 text-red-300',
};

export function LeadsPage() {
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);

  const { data, isLoading, isError, error } = useLeads({
    q: q || undefined,
    status: status || undefined,
  });
  const updateStatus = useUpdateLeadStatus();
  const del = useDeleteLead();

  const leads = data?.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setShowImport(true)}>
            Import CSV
          </button>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            + New lead
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(qInput.trim());
          }}
        >
          <input
            className="input w-64"
            placeholder="Search company / domain / email…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
          <button className="btn-ghost">Search</button>
        </form>
        <select
          className="input w-44"
          value={status}
          onChange={(e) => setStatus(e.target.value as LeadStatus | '')}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-border">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-2">Company</th>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">Location</th>
              <th className="px-4 py-2">Industry</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-red-400">
                  {extractApiError(error)}
                </td>
              </tr>
            )}
            {!isLoading && leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No leads yet. Add one or import a CSV.
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="cursor-pointer border-t border-surface-border hover:bg-white/5"
                onClick={() => setSelected(lead)}
              >
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-200">{lead.company.name}</div>
                  <div className="text-xs text-slate-500">{lead.company.domain ?? '—'}</div>
                </td>
                <td className="px-4 py-2">{lead.contact?.email ?? '—'}</td>
                <td className="px-4 py-2 text-slate-400">
                  {[lead.company.city, lead.company.country].filter(Boolean).join(', ') || '—'}
                </td>
                <td className="px-4 py-2 text-slate-400">{lead.company.industry ?? '—'}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                      STATUS_COLOR[lead.status] ?? 'bg-slate-500/20 text-slate-300'
                    }`}
                  >
                    {lead.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="text-xs text-red-400 hover:underline"
                    onClick={() => del.mutate(lead.id)}
                  >
                    delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <LeadDrawer
          lead={selected}
          onClose={() => setSelected(null)}
          onStatus={(s) => {
            updateStatus.mutate({ id: selected.id, status: s });
            setSelected({ ...selected, status: s });
          }}
        />
      )}
      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}

function LeadDrawer({
  lead,
  onClose,
  onStatus,
}: {
  lead: Lead;
  onClose: () => void;
  onStatus: (s: LeadStatus) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-surface-border bg-surface-raised p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{lead.company.name}</h2>
            <a
              href={lead.company.website ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-brand hover:underline"
            >
              {lead.company.website ?? lead.company.domain ?? '—'}
            </a>
          </div>
          <button className="btn-ghost py-1" onClick={onClose}>
            ✕
          </button>
        </div>

        <dl className="space-y-2 text-sm">
          <Row label="Industry" value={lead.company.industry} />
          <Row
            label="Location"
            value={[lead.company.city, lead.company.country].filter(Boolean).join(', ')}
          />
          <Row label="Contact" value={lead.contact?.name} />
          <Row label="Email" value={lead.contact?.email} />
          <Row label="Title" value={lead.contact?.title} />
          <Row label="Source" value={lead.source} />
        </dl>

        <div className="mt-5">
          <label className="label">Status</label>
          <select
            className="input"
            value={lead.status}
            onChange={(e) => onStatus(e.target.value as LeadStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <AuditSection lead={lead} />
        <EmailSection lead={lead} />
      </div>
    </div>
  );
}

function AuditSection({ lead }: { lead: Lead }) {
  const { data: audit, isLoading } = useLeadAudit(lead.id);
  const runAudit = useRunAudit(lead.id);
  const summarize = useSummarizeAudit(lead.id);
  const scrape = useScrapeContacts(lead.id);
  const [err, setErr] = useState<string | null>(null);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);

  const doScrape = async (): Promise<void> => {
    setErr(null);
    setScrapeMsg(null);
    try {
      const r = await scrape.mutateAsync();
      const bits: string[] = [];
      bits.push(r.emails.length ? `${r.emails.length} email(s): ${r.emails.slice(0, 3).join(', ')}` : 'no emails found');
      const socialCount = Object.keys(r.socials).length;
      if (socialCount) bits.push(`${socialCount} social link(s)`);
      if (r.contactUpdated) bits.push('contact email auto-filled ✓');
      setScrapeMsg(bits.join(' · '));
    } catch (e) {
      setErr(extractApiError(e));
    }
  };

  const doRun = async (): Promise<void> => {
    setErr(null);
    try {
      await runAudit.mutateAsync();
    } catch (e) {
      setErr(extractApiError(e));
    }
  };

  const doSummarize = async (): Promise<void> => {
    setErr(null);
    try {
      await summarize.mutateAsync();
    } catch (e) {
      setErr(extractApiError(e));
    }
  };

  return (
    <div className="mt-6 border-t border-surface-border pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Website audit</h3>
        <div className="flex gap-2">
          <button
            className="btn-ghost py-1 text-xs"
            disabled={scrape.isPending}
            title="Scrape the company site for emails, phone & social links"
            onClick={() => void doScrape()}
          >
            {scrape.isPending ? 'Scraping…' : 'Find contacts'}
          </button>
          <button
            className="btn-ghost py-1 text-xs"
            disabled={runAudit.isPending}
            onClick={() => void doRun()}
          >
            {runAudit.isPending ? 'Auditing…' : audit ? 'Re-audit' : 'Run audit'}
          </button>
        </div>
      </div>

      {scrapeMsg && <p className="mb-3 text-xs text-slate-400">{scrapeMsg}</p>}
      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && !audit && !runAudit.isPending && (
        <p className="text-sm text-slate-500">No audit yet — run one to analyze the site.</p>
      )}

      {audit && (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {audit.performanceScore != null && (
              <Badge label={`Perf ${audit.performanceScore}/100`} />
            )}
            {audit.responseTimeMs != null && (
              <Badge label={`${(audit.responseTimeMs / 1000).toFixed(1)}s load`} />
            )}
            <Badge label={audit.mobileFriendly ? 'Mobile ✓' : 'No mobile'} />
            <Badge label={audit.https ? 'HTTPS ✓' : 'No HTTPS'} />
            {audit.cms && <Badge label={audit.cms} />}
          </div>

          {audit.findings && audit.findings.length > 0 && (
            <ul className="space-y-1 text-xs text-slate-400">
              {audit.findings.slice(0, 6).map((f) => (
                <li key={f.code}>
                  <span
                    className={
                      f.severity === 'high'
                        ? 'text-red-400'
                        : f.severity === 'medium'
                          ? 'text-amber-400'
                          : 'text-slate-500'
                    }
                  >
                    ●
                  </span>{' '}
                  {f.message}
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-md border border-surface-border bg-surface p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">AI summary</span>
              <button
                className="btn-primary py-1 text-xs"
                disabled={summarize.isPending}
                onClick={() => void doSummarize()}
              >
                {summarize.isPending ? 'Summarizing…' : audit.aiSummary ? 'Regenerate' : 'Summarize'}
              </button>
            </div>
            {audit.aiSummary ? (
              <p className="whitespace-pre-wrap text-xs text-slate-300">{audit.aiSummary}</p>
            ) : (
              <p className="text-xs text-slate-500">
                Turn these findings into a client-facing narrative.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-surface-border bg-surface px-2 py-0.5 text-xs text-slate-300">
      {label}
    </span>
  );
}

function EmailSection({ lead }: { lead: Lead }) {
  const { data: emails, isLoading } = useLeadEmails(lead.id);
  const generate = useGenerateEmail(lead.id);
  const followUp = useGenerateFollowUp(lead.id);
  const variants = useGenerateVariants(lead.id);
  const approve = useApproveLeadEmail(lead.id);
  const reject = useRejectLeadEmail(lead.id);
  const [err, setErr] = useState<string | null>(null);

  const hasEmails = Boolean(emails?.length);
  const busy = generate.isPending || followUp.isPending || variants.isPending;

  const wrap = (fn: () => Promise<unknown>) => async (): Promise<void> => {
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(extractApiError(e));
    }
  };

  return (
    <div className="mt-6 border-t border-surface-border pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">AI cold email</h3>
        <button
          className="btn-primary py-1 text-xs"
          disabled={busy}
          onClick={() => void wrap(() => generate.mutateAsync())()}
        >
          {generate.isPending ? 'Generating…' : hasEmails ? 'Regenerate' : 'Generate email'}
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Personalized from this lead&apos;s website audit + score.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          className="btn-ghost py-1 text-xs"
          disabled={busy || !hasEmails}
          title={hasEmails ? '' : 'Generate an initial email first'}
          onClick={() => void wrap(() => followUp.mutateAsync())()}
        >
          {followUp.isPending ? 'Writing…' : '+ Follow-up'}
        </button>
        <button
          className="btn-ghost py-1 text-xs"
          disabled={busy}
          onClick={() => void wrap(() => variants.mutateAsync(2))()}
        >
          {variants.isPending ? 'Writing…' : 'A/B variants'}
        </button>
      </div>

      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && !emails?.length && !generate.isPending && (
        <p className="text-sm text-slate-500">No email generated yet.</p>
      )}

      <div className="space-y-3">
        {emails?.map((e) => (
          <EmailCard
            key={e.id}
            email={e}
            onApprove={async () => {
              await approve.mutateAsync(e.id);
            }}
            onReject={async () => {
              await reject.mutateAsync(e.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function EmailCard({
  email,
  onApprove,
  onReject,
}: {
  email: EmailDraft;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const runReview = async (next: 'approve' | 'reject'): Promise<void> => {
    setBusy(next);
    try {
      if (next === 'approve') {
        await onApprove();
      } else {
        await onReject();
      }
    } finally {
      setBusy(null);
    }
  };

  const cost = Number(email.costUsd);
  const statusClass =
    email.status === 'APPROVED'
      ? 'bg-green-500/20 text-green-300'
      : email.status === 'REJECTED'
        ? 'bg-red-500/20 text-red-300'
        : 'bg-amber-500/20 text-amber-300';

  const kindLabel =
    email.kind === 'FOLLOWUP'
      ? `Follow-up #${email.sequenceIndex}`
      : email.kind === 'VARIANT'
        ? `Variant ${email.variantLabel ?? ''}`.trim()
        : 'Initial';

  return (
    <div className="rounded-lg border border-surface-border bg-surface p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-medium text-brand">
              {kindLabel}
            </span>
            <span className="text-xs font-medium text-slate-400">Subject</span>
          </div>
          <div className="text-sm font-medium text-slate-100">{email.subject}</div>
        </div>
        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${statusClass}`}>
          {email.status}
        </span>
      </div>
      <div className="whitespace-pre-wrap text-sm text-slate-300">{email.body}</div>
      <div className="mt-3 border-t border-surface-border pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500">
            {email.provider}/{email.model} · {email.outputTokens} tok · ~${cost.toFixed(4)}
          </span>
          <div className="flex gap-2">
            <button className="btn-ghost py-1 text-xs" onClick={() => void copy()}>
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
            <button
              className="btn-ghost py-1 text-xs text-green-300"
              disabled={busy !== null}
              onClick={() => void runReview('approve')}
            >
              {busy === 'approve' ? 'Approving…' : 'Approve'}
            </button>
            <button
              className="btn-ghost py-1 text-xs text-red-300"
              disabled={busy !== null}
              onClick={() => void runReview('reject')}
            >
              {busy === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
        {email.reviewedAt && (
          <div className="mt-1 text-[11px] text-slate-500">
            Reviewed {new Date(email.reviewedAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between border-b border-surface-border py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200">{value || '—'}</dd>
    </div>
  );
}

function AddLeadModal({ onClose }: { onClose: () => void }) {
  const create = useCreateLead();
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setErr(null);
    try {
      await create.mutateAsync({
        company: { name: name.trim(), website: website.trim() || undefined },
        contact: email.trim() ? { email: email.trim() } : undefined,
      });
      onClose();
    } catch (e) {
      setErr(extractApiError(e));
    }
  };

  return (
    <Modal title="New lead" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="label">Company name *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Website</label>
          <input
            className="input"
            placeholder="https://example.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Contact email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          className="btn-primary w-full"
          disabled={!name.trim() || create.isPending}
          onClick={() => void submit()}
        >
          {create.isPending ? 'Adding…' : 'Add lead'}
        </button>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const importLeads = useImportLeads();
  const [csv, setCsv] = useState('company,website,email,name,industry,country\n');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (): Promise<void> => {
    setErr(null);
    setResult(null);
    try {
      setResult(await importLeads.mutateAsync(csv));
    } catch (e) {
      setErr(extractApiError(e));
    }
  };

  return (
    <Modal title="Import leads (CSV)" onClose={onClose}>
      <p className="mb-2 text-xs text-slate-400">
        First row = headers. Recognized: company, website, domain, email, name, title, industry,
        country, city.
      </p>
      <textarea
        className="input h-40 font-mono text-xs"
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
      />
      {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
      {result && (
        <div className="mt-3 rounded-lg bg-white/5 p-3 text-sm">
          <div className="text-slate-200">
            Imported {result.imported} · Duplicates {result.duplicates} · Failed {result.failed} ·
            Total {result.total}
          </div>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-red-400">
              {result.errors.slice(0, 5).map((e) => (
                <li key={e.row}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button
        className="btn-primary mt-3 w-full"
        disabled={importLeads.isPending}
        onClick={() => void run()}
      >
        {importLeads.isPending ? 'Importing…' : 'Import'}
      </button>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-surface-border bg-surface-raised p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <button className="btn-ghost py-1" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
