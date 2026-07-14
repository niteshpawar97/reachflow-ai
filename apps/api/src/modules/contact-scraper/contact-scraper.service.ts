import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface ScrapeResult {
  url: string;
  status: 'OK' | 'PARTIAL' | 'FAILED';
  pagesScanned: number;
  emails: string[];
  phones: string[];
  socials: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  error?: string;
}

const UA =
  'Mozilla/5.0 (compatible; ReachFlowBot/1.0; +https://reachflow.ai/bot)';
const TIMEOUT_MS = 12_000;
const MAX_PAGES = 4;

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Junk that regularly shows up but isn't a real contact address.
const EMAIL_BLOCKLIST = [
  'example.com',
  'sentry.io',
  'sentry-next',
  'wixpress.com',
  'godaddy',
  'cloudflare',
  'domain.com',
  'yourdomain',
  'your-email',
  'email@',
  'name@',
  'user@',
  'test@',
];
const IMAGE_EXT = /\.(png|jpe?g|gif|svg|webp|ico|css|js)$/i;

@Injectable()
export class ContactScraperService {
  private readonly logger = new Logger(ContactScraperService.name);

  async scrape(rawUrl: string): Promise<ScrapeResult> {
    const base = this.normalizeUrl(rawUrl);
    const origin = new URL(base).origin;

    const emails = new Set<string>();
    const phones = new Set<string>();
    const socials: ScrapeResult['socials'] = {};
    let pagesScanned = 0;
    let anyFailure = false;

    // Start with the homepage, then follow same-origin contact/about links.
    const homepage = await this.fetchPage(base);
    if (!homepage) {
      return {
        url: base,
        status: 'FAILED',
        pagesScanned: 0,
        emails: [],
        phones: [],
        socials: {},
        error: 'Homepage could not be reached',
      };
    }

    const toVisit = new Set<string>([base]);
    for (const href of this.contactLinks(homepage, origin)) {
      if (toVisit.size >= MAX_PAGES) break;
      toVisit.add(href);
    }

    for (const pageUrl of toVisit) {
      const html = pageUrl === base ? homepage : await this.fetchPage(pageUrl);
      if (!html) {
        anyFailure = true;
        continue;
      }
      pagesScanned += 1;
      this.extractInto(html, emails, phones, socials);
    }

    return {
      url: base,
      status: anyFailure && pagesScanned > 0 ? 'PARTIAL' : pagesScanned > 0 ? 'OK' : 'FAILED',
      pagesScanned,
      emails: [...emails].slice(0, 20),
      phones: [...phones].slice(0, 10),
      socials,
    };
  }

  private async fetchPage(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': UA, accept: 'text/html,*/*' },
      });
      if (!res.ok) return null;
      const type = res.headers.get('content-type') ?? '';
      if (!type.includes('html')) return null;
      return await res.text();
    } catch (e) {
      this.logger.debug(`fetch failed for ${url}: ${e instanceof Error ? e.message : e}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Same-origin links whose href/text suggests a contact/about/team page. */
  private contactLinks(html: string, origin: string): string[] {
    const $ = cheerio.load(html);
    const found = new Set<string>();
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const text = ($(el).text() ?? '').toLowerCase();
      const hay = `${href.toLowerCase()} ${text}`;
      if (!/contact|about|team|imprint|impressum|reach|connect/.test(hay)) return;
      try {
        const abs = new URL(href, origin);
        if (abs.origin === origin) found.add(abs.toString().split('#')[0]!);
      } catch {
        /* ignore bad href */
      }
    });
    return [...found];
  }

  private extractInto(
    html: string,
    emails: Set<string>,
    phones: Set<string>,
    socials: ScrapeResult['socials'],
  ): void {
    const $ = cheerio.load(html);

    // mailto: / tel: are the most reliable signals.
    $('a[href^="mailto:"]').each((_, el) => {
      const addr = ($(el).attr('href') ?? '').replace(/^mailto:/i, '').split('?')[0]!.trim();
      this.addEmail(addr, emails);
    });
    $('a[href^="tel:"]').each((_, el) => {
      const num = ($(el).attr('href') ?? '').replace(/^tel:/i, '').trim();
      if (num.replace(/\D/g, '').length >= 7) phones.add(num);
    });

    // Social profile links — match by hostname (avoids e.g. firefox.com ~ x.com).
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      let host: string;
      try {
        host = new URL(href).hostname.toLowerCase().replace(/^www\./, '');
      } catch {
        return;
      }
      if (!socials.linkedin && host === 'linkedin.com' && /\/(company|in)\//i.test(href)) {
        socials.linkedin = href;
      } else if (!socials.twitter && (host === 'twitter.com' || host === 'x.com')) {
        socials.twitter = href;
      } else if (!socials.facebook && host === 'facebook.com') {
        socials.facebook = href;
      } else if (!socials.instagram && host === 'instagram.com') {
        socials.instagram = href;
      }
    });

    // Fallback: scan visible text for bare email addresses.
    const bodyText = $('body').text();
    const matches = bodyText.match(EMAIL_RE) ?? [];
    for (const m of matches) this.addEmail(m, emails);
  }

  private addEmail(raw: string, emails: Set<string>): void {
    const email = raw.trim().toLowerCase();
    if (!email.includes('@')) return;
    if (IMAGE_EXT.test(email)) return;
    if (EMAIL_BLOCKLIST.some((b) => email.includes(b))) return;
    if (email.length > 120) return;
    emails.add(email);
  }

  private normalizeUrl(raw: string): string {
    const trimmed = raw.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }
}
