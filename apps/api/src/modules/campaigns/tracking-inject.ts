const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Turns plain text into simple, safe HTML: escapes text, turns bare http(s)
 * URLs into anchors (so click-tracking can wrap them), and preserves
 * paragraphs / line breaks. Anchor hrefs keep the RAW url so tracking can
 * encode it correctly.
 */
export function textToHtml(text: string): string {
  const urlRe = /(https?:\/\/[^\s<"]+)/g;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(text)) !== null) {
    out += esc(text.slice(last, m.index));
    const url = m[1]!;
    out += `<a href="${url}">${esc(url)}</a>`;
    last = m.index + m[0].length;
  }
  out += esc(text.slice(last));

  return out
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

/**
 * Adds open + click tracking to an HTML email:
 * - rewrites every http(s) link through the click-redirect endpoint
 * - appends a 1x1 open-tracking pixel
 * `baseUrl` must be the PUBLICLY reachable API base (e.g. https://app.x.com/api).
 */
export function injectTracking(html: string, token: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');

  const wrapped = html.replace(
    /href="(https?:\/\/[^"]+)"/gi,
    (_match, url: string) => `href="${base}/tracking/click/${token}?u=${encodeURIComponent(url)}"`,
  );

  const pixel = `<img src="${base}/tracking/open/${token}.gif" width="1" height="1" alt="" style="display:none;max-height:0;overflow:hidden" />`;
  return `${wrapped}\n${pixel}`;
}

/** The public base URL used to build tracking links. */
export function trackingBaseUrl(): string {
  const explicit = process.env.APP_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const port = process.env.API_PORT ?? '3000';
  const prefix = process.env.API_PREFIX ?? 'api';
  return `http://localhost:${port}/${prefix}`;
}

/**
 * Appends an unsubscribe footer. MUST run AFTER injectTracking (whose click-wrap
 * regex would otherwise re-wrap this link too — this href points straight at
 * our own unsubscribe endpoint, not a click-tracked destination).
 */
export function appendUnsubscribeFooter(html: string, token: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const url = `${base}/tracking/unsubscribe/${token}`;
  const footer = `<p style="margin-top:16px;font-size:11px;color:#94a3b8">
    <a href="${url}" style="color:#94a3b8">Unsubscribe</a>
  </p>`;
  return `${html}\n${footer}`;
}
