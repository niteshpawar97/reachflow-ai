import { useState } from 'react';
import { extractApiError } from '../lib/api';
import {
  useSendReply,
  useSuggestReply,
  useSyncMailboxInbox,
  useThread,
  useThreads,
} from '../features/inbox/useInbox';
import type { Message, ReplyClassification } from '../features/inbox/inbox.api';
import { useMailboxes } from '../features/mailboxes/useMailboxes';

const CLASSIFICATION_LABEL: Record<ReplyClassification, string> = {
  UNCLASSIFIED: 'New',
  INTERESTED: 'Interested',
  NOT_INTERESTED: 'Not interested',
  MEETING_REQUEST: 'Wants a meeting',
  PRICING_QUESTION: 'Pricing question',
  REFERRAL: 'Referral',
  OUT_OF_OFFICE: 'Out of office',
  UNSUBSCRIBE_REQUEST: 'Unsubscribe',
  BOUNCE: 'Bounce',
  SPAM: 'Spam',
  OTHER: 'Other',
};

const CLASSIFICATION_CLASS: Partial<Record<ReplyClassification, string>> = {
  INTERESTED: 'bg-green-500/20 text-green-300',
  MEETING_REQUEST: 'bg-green-500/20 text-green-300',
  PRICING_QUESTION: 'bg-blue-500/20 text-blue-300',
  NOT_INTERESTED: 'bg-slate-500/20 text-slate-400',
  UNSUBSCRIBE_REQUEST: 'bg-amber-500/20 text-amber-300',
  BOUNCE: 'bg-red-500/20 text-red-300',
  SPAM: 'bg-red-500/20 text-red-300',
};

export function InboxPage() {
  const { data: threads, isLoading } = useThreads();
  const [selected, setSelected] = useState<string | undefined>();
  const { data: mailboxes } = useMailboxes();
  const sync = useSyncMailboxInbox();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const runSync = async (): Promise<void> => {
    setSyncMsg(null);
    const targets = mailboxes ?? [];
    if (targets.length === 0) {
      setSyncMsg('Add a mailbox first.');
      return;
    }
    try {
      let totalFetched = 0;
      let totalReplies = 0;
      for (const mb of targets) {
        const r = await sync.mutateAsync(mb.id);
        totalFetched += r.fetched;
        totalReplies += r.replies;
      }
      setSyncMsg(`Synced: ${totalFetched} new message(s), ${totalReplies} replies matched.`);
    } catch (e) {
      setSyncMsg(extractApiError(e));
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-7xl gap-4">
      <div className="flex w-80 shrink-0 flex-col rounded-xl border border-surface-border bg-surface">
        <div className="flex items-center justify-between border-b border-surface-border p-3">
          <h2 className="font-semibold">Inbox</h2>
          <button className="btn-ghost py-1 text-xs" disabled={sync.isPending} onClick={() => void runSync()}>
            {sync.isPending ? 'Syncing…' : '↻ Sync'}
          </button>
        </div>
        {syncMsg && <p className="border-b border-surface-border p-2 text-xs text-slate-400">{syncMsg}</p>}

        <div className="flex-1 overflow-y-auto">
          {isLoading && <p className="p-3 text-sm text-slate-500">Loading…</p>}
          {!isLoading && !threads?.length && (
            <p className="p-3 text-sm text-slate-500">
              No replies yet. Enable IMAP on your mailbox, then hit Sync.
            </p>
          )}
          {threads?.map((t) => (
            <button
              key={t.campaignLeadId}
              onClick={() => setSelected(t.campaignLeadId)}
              className={`block w-full border-b border-surface-border px-3 py-2.5 text-left transition ${
                selected === t.campaignLeadId ? 'bg-brand/10' : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-100">
                  {t.company?.name ?? t.contact?.email ?? 'Unknown'}
                </span>
                {!t.lastMessage.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
              </div>
              <div className="mt-0.5 truncate text-xs text-slate-500">{t.lastMessage.snippet}</div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    CLASSIFICATION_CLASS[t.lastMessage.classification] ?? 'bg-white/10 text-slate-300'
                  }`}
                >
                  {CLASSIFICATION_LABEL[t.lastMessage.classification]}
                </span>
                <span className="text-[10px] text-slate-500">
                  {new Date(t.lastMessage.receivedAt).toLocaleDateString()}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-surface-border bg-surface">
        {selected ? (
          <ThreadView campaignLeadId={selected} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Select a conversation
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadView({ campaignLeadId }: { campaignLeadId: string }) {
  const { data: messages, isLoading } = useThread(campaignLeadId);
  const sendReply = useSendReply(campaignLeadId);
  const suggest = useSuggestReply();
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const lastInbound = [...(messages ?? [])].reverse().find((m) => m.direction === 'INBOUND');

  const doSuggest = async (): Promise<void> => {
    if (!lastInbound) return;
    setErr(null);
    try {
      const r = await suggest.mutateAsync(lastInbound.id);
      setDraft(r.suggestion);
    } catch (e) {
      setErr(extractApiError(e));
    }
  };

  const doSend = async (): Promise<void> => {
    setErr(null);
    setSent(false);
    try {
      await sendReply.mutateAsync(draft);
      setDraft('');
      setSent(true);
    } catch (e) {
      setErr(extractApiError(e));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {messages?.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      <div className="border-t border-surface-border p-3">
        {err && <p className="mb-2 text-sm text-red-400">{err}</p>}
        {sent && <p className="mb-2 text-sm text-green-300">Reply sent.</p>}
        <textarea
          className="input h-24 w-full"
          placeholder="Write a reply…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="mt-2 flex justify-between">
          <button
            className="btn-ghost py-1 text-xs"
            disabled={suggest.isPending || !lastInbound}
            onClick={() => void doSuggest()}
          >
            {suggest.isPending ? 'Thinking…' : '✨ Suggest reply'}
          </button>
          <button
            className="btn-primary py-1 text-xs"
            disabled={sendReply.isPending || draft.trim().length === 0}
            onClick={() => void doSend()}
          >
            {sendReply.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isOut = message.direction === 'OUTBOUND';
  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-lg rounded-lg px-3 py-2 text-sm ${
          isOut ? 'bg-brand/20 text-slate-100' : 'bg-white/5 text-slate-200'
        }`}
      >
        {message.subject && <div className="mb-1 text-xs font-medium text-slate-400">{message.subject}</div>}
        <div className="whitespace-pre-wrap">{message.bodyText}</div>
        {message.classificationSummary && (
          <div className="mt-2 border-t border-white/10 pt-1 text-[11px] text-slate-400">
            {message.classificationSummary}
          </div>
        )}
        <div className="mt-1 text-[10px] text-slate-500">
          {new Date(message.receivedAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
