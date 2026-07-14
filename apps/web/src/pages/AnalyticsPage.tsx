import { useMemo, useState } from 'react';
import { downloadCsvExport } from '../features/analytics/analytics.api';
import { useCampaignBreakdown, useFunnel, useOverview } from '../features/analytics/useAnalytics';
import type { DayBucket } from '../features/analytics/analytics.api';

// Validated categorical palette (dark surface #1a1a19), fixed order — see the
// dataviz skill's reference palette. Slots 1/2/3/5: blue, aqua, yellow, violet.
const SERIES: Array<{ key: keyof Omit<DayBucket, 'date'>; label: string; color: string }> = [
  { key: 'sent', label: 'Sent', color: '#3987e5' },
  { key: 'opened', label: 'Opened', color: '#199e70' },
  { key: 'clicked', label: 'Clicked', color: '#c98500' },
  { key: 'replied', label: 'Replied', color: '#9085e9' },
];

export function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data: overview, isLoading: overviewLoading } = useOverview(days);
  const { data: funnel } = useFunnel();
  const { data: campaigns } = useCampaignBreakdown();
  const [exporting, setExporting] = useState(false);

  const doExport = async (): Promise<void> => {
    setExporting(true);
    try {
      await downloadCsvExport();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-slate-400">Trends, funnel, and per-campaign performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-32" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button className="btn-ghost" disabled={exporting} onClick={() => void doExport()}>
            {exporting ? 'Exporting…' : '⇩ Export CSV'}
          </button>
        </div>
      </div>

      <section className="card">
        <h2 className="mb-3 font-medium">Activity trend</h2>
        {overviewLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {overview && overview.length > 0 && <TrendChart data={overview} />}
      </section>

      <section className="card">
        <h2 className="mb-3 font-medium">Funnel</h2>
        {funnel && <FunnelChart funnel={funnel} />}
      </section>

      <section className="card">
        <h2 className="mb-3 font-medium">Campaigns</h2>
        {!campaigns?.length && <p className="text-sm text-slate-500">No campaigns yet.</p>}
        {!!campaigns?.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Campaign</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Leads</th>
                  <th className="px-3 py-2">Sent</th>
                  <th className="px-3 py-2">Open %</th>
                  <th className="px-3 py-2">Click %</th>
                  <th className="px-3 py-2">Reply %</th>
                  <th className="px-3 py-2">Bounce %</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-t border-surface-border">
                    <td className="px-3 py-2 font-medium text-slate-100">{c.name}</td>
                    <td className="px-3 py-2 text-slate-400">{c.status}</td>
                    <td className="px-3 py-2 text-slate-300">{c.total}</td>
                    <td className="px-3 py-2 text-slate-300">{c.sent}</td>
                    <td className="px-3 py-2 text-slate-300">{c.openRate}%</td>
                    <td className="px-3 py-2 text-slate-300">{c.clickRate}%</td>
                    <td className="px-3 py-2 text-slate-300">{c.replyRate}%</td>
                    <td className="px-3 py-2 text-slate-300">{c.bounceRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function TrendChart({ data }: { data: DayBucket[] }) {
  const [hover, setHover] = useState<{ day: DayBucket; x: number } | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => SERIES.map((s) => d[s.key])));

  const width = 760;
  const height = 220;
  const padBottom = 24;
  const padTop = 8;
  const groupWidth = width / data.length;
  const barWidth = Math.max(2, groupWidth / (SERIES.length + 1.5));

  const scaleY = (v: number): number => padTop + (1 - v / max) * (height - padTop - padBottom);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-xs">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-slate-400">{s.label}</span>
          </span>
        ))}
      </div>
      <div className="relative overflow-x-auto">
        <svg width={width} height={height} className="min-w-full">
          <line x1={0} y1={height - padBottom} x2={width} y2={height - padBottom} stroke="#334155" strokeWidth={1} />
          {data.map((d, i) => {
            const groupX = i * groupWidth;
            return (
              <g
                key={d.date}
                onMouseEnter={() => setHover({ day: d, x: groupX + groupWidth / 2 })}
                onMouseLeave={() => setHover(null)}
              >
                <rect x={groupX} y={padTop} width={groupWidth} height={height - padTop - padBottom} fill="transparent" />
                {SERIES.map((s, si) => {
                  const v = d[s.key];
                  const barX = groupX + (groupWidth - SERIES.length * barWidth) / 2 + si * barWidth;
                  const y = scaleY(v);
                  const barHeight = height - padBottom - y;
                  return (
                    <rect
                      key={s.key}
                      x={barX}
                      y={y}
                      width={barWidth - 1}
                      height={Math.max(0, barHeight)}
                      rx={1.5}
                      fill={s.color}
                    />
                  );
                })}
                {(i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 6) === 0) && (
                  <text x={groupX + groupWidth / 2} y={height - 6} fontSize={9} textAnchor="middle" fill="#64748b">
                    {d.date.slice(5)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover && (
          <div
            className="pointer-events-none absolute top-0 rounded-md border border-surface-border bg-surface-raised px-2 py-1.5 text-xs shadow-lg"
            style={{ left: Math.min(hover.x, width - 140) }}
          >
            <div className="mb-1 font-medium text-slate-200">{hover.day.date}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}: {hover.day[s.key]}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FunnelChart({
  funnel,
}: {
  funnel: { totalLeads: number; contacted: number; opened: number; clicked: number; replied: number; won: number };
}) {
  const steps = useMemo(
    () => [
      { label: 'Leads', value: funnel.totalLeads },
      { label: 'Contacted', value: funnel.contacted },
      { label: 'Opened', value: funnel.opened },
      { label: 'Clicked', value: funnel.clicked },
      { label: 'Replied', value: funnel.replied },
      { label: 'Won', value: funnel.won },
    ],
    [funnel],
  );
  const max = Math.max(1, steps[0]?.value ?? 1);

  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const pct = Math.round((s.value / max) * 1000) / 10;
        const prev = i > 0 ? steps[i - 1]!.value : null;
        const convPct = prev && prev > 0 ? Math.round((s.value / prev) * 1000) / 10 : null;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-slate-400">{s.label}</span>
            <div className="h-6 flex-1 rounded bg-white/5">
              <div
                className="h-6 rounded bg-[#3987e5]"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-xs text-slate-300">{s.value}</span>
            <span className="w-14 shrink-0 text-right text-[11px] text-slate-500">
              {convPct != null ? `${convPct}%` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
