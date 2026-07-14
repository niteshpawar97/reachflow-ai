import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface AuditFinding {
  code: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface AuditResult {
  url: string;
  status: 'OK' | 'PARTIAL' | 'FAILED';
  https: boolean;
  sslValid: boolean;
  statusCode: number | null;
  responseTimeMs: number | null;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  mobileFriendly: boolean;
  hasContactForm: boolean;
  hasCta: boolean;
  cms: string | null;
  techStack: string[];
  findings: AuditFinding[];
  performanceScore: number;
  error: string | null;
}

const TIMEOUT_MS = 12_000;
const UA =
  'Mozilla/5.0 (compatible; ReachFlowBot/0.1; +https://reachflow.ai/bot)';
const CTA_WORDS = [
  'get started',
  'contact us',
  'contact',
  'book a',
  'book now',
  'get a quote',
  'request a',
  'sign up',
  'get demo',
  'book demo',
  'buy now',
  'start free',
];

@Injectable()
export class WebsiteAnalyzerService {
  private readonly logger = new Logger(WebsiteAnalyzerService.name);

  async analyze(rawUrl: string): Promise<AuditResult> {
    const url = this.normalizeUrl(rawUrl);
    const https = url.startsWith('https://');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const started = Date.now();

    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': UA, accept: 'text/html,*/*' },
      });
      const responseTimeMs = Date.now() - started;
      const html = await res.text();
      return this.buildResult(url, https, res, html, responseTimeMs);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'fetch failed';
      this.logger.warn(`Audit failed for ${url}: ${message}`);
      return {
        url,
        status: 'FAILED',
        https,
        sslValid: false,
        statusCode: null,
        responseTimeMs: null,
        title: null,
        metaDescription: null,
        h1Count: 0,
        mobileFriendly: false,
        hasContactForm: false,
        hasCta: false,
        cms: null,
        techStack: [],
        findings: [
          { code: 'UNREACHABLE', severity: 'high', message: `Site could not be reached: ${message}` },
        ],
        performanceScore: 0,
        error: message,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private buildResult(
    url: string,
    https: boolean,
    res: Response,
    html: string,
    responseTimeMs: number,
  ): AuditResult {
    const $ = cheerio.load(html);
    const title = $('title').first().text().trim() || null;
    const metaDescription =
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      null;
    const h1Count = $('h1').length;
    const mobileFriendly = $('meta[name="viewport"]').length > 0;

    const hasContactForm =
      $('form').toArray().some((f) => {
        const html2 = $(f).html()?.toLowerCase() ?? '';
        const action = ($(f).attr('action') ?? '').toLowerCase();
        return (
          html2.includes('email') ||
          html2.includes('contact') ||
          html2.includes('message') ||
          action.includes('contact')
        );
      }) || $('a[href^="mailto:"]').length > 0;

    const bodyText = $('a, button')
      .toArray()
      .map((el) => $(el).text().toLowerCase())
      .join(' | ');
    const hasCta = CTA_WORDS.some((w) => bodyText.includes(w));

    const { cms, techStack } = this.detectTech($, res.headers, html);

    const statusCode = res.status;
    const findings = this.deriveFindings({
      https,
      statusCode,
      responseTimeMs,
      metaDescription,
      h1Count,
      mobileFriendly,
      hasContactForm,
      hasCta,
    });
    const performanceScore = this.score(responseTimeMs, findings);

    return {
      url,
      status: statusCode >= 400 ? 'PARTIAL' : 'OK',
      https,
      sslValid: https, // fetch succeeded over https => cert was valid
      statusCode,
      responseTimeMs,
      title,
      metaDescription,
      h1Count,
      mobileFriendly,
      hasContactForm,
      hasCta,
      cms,
      techStack,
      findings,
      performanceScore,
      error: null,
    };
  }

  private deriveFindings(x: {
    https: boolean;
    statusCode: number;
    responseTimeMs: number;
    metaDescription: string | null;
    h1Count: number;
    mobileFriendly: boolean;
    hasContactForm: boolean;
    hasCta: boolean;
  }): AuditFinding[] {
    const f: AuditFinding[] = [];
    if (!x.https)
      f.push({ code: 'NO_HTTPS', severity: 'high', message: 'Site is not served over HTTPS' });
    if (x.statusCode >= 400)
      f.push({
        code: 'BAD_STATUS',
        severity: 'high',
        message: `Homepage returned HTTP ${x.statusCode}`,
      });
    if (x.responseTimeMs > 3000)
      f.push({
        code: 'SLOW',
        severity: 'medium',
        message: `Slow load: ${(x.responseTimeMs / 1000).toFixed(1)}s to first response`,
      });
    if (!x.metaDescription)
      f.push({
        code: 'NO_META_DESCRIPTION',
        severity: 'medium',
        message: 'Missing meta description (hurts SEO/click-through)',
      });
    if (x.h1Count === 0)
      f.push({ code: 'NO_H1', severity: 'low', message: 'No H1 heading found' });
    if (!x.mobileFriendly)
      f.push({
        code: 'NOT_MOBILE_FRIENDLY',
        severity: 'high',
        message: 'No mobile viewport tag — likely not mobile-optimized',
      });
    if (!x.hasContactForm)
      f.push({
        code: 'NO_CONTACT_FORM',
        severity: 'medium',
        message: 'No contact form or email link found',
      });
    if (!x.hasCta)
      f.push({
        code: 'NO_CTA',
        severity: 'medium',
        message: 'No clear call-to-action detected',
      });
    return f;
  }

  private score(responseTimeMs: number, findings: AuditFinding[]): number {
    let score = 100;
    if (responseTimeMs > 5000) score -= 25;
    else if (responseTimeMs > 3000) score -= 15;
    else if (responseTimeMs > 1500) score -= 5;
    for (const finding of findings) {
      score -= finding.severity === 'high' ? 15 : finding.severity === 'medium' ? 8 : 3;
    }
    return Math.max(0, Math.min(100, score));
  }

  private detectTech(
    $: cheerio.CheerioAPI,
    headers: Headers,
    html: string,
  ): { cms: string | null; techStack: string[] } {
    const tech = new Set<string>();
    let cms: string | null = null;
    const lower = html.toLowerCase();

    const server = headers.get('server');
    const powered = headers.get('x-powered-by');
    if (server) tech.add(server.split('/')[0] ?? server);
    if (powered) tech.add(powered.split('/')[0] ?? powered);

    const generator = $('meta[name="generator"]').attr('content') ?? '';
    if (generator) tech.add(generator.split(' ')[0] ?? generator);

    const patterns: Array<[RegExp, string, boolean]> = [
      [/wp-content|wp-json|wordpress/i, 'WordPress', true],
      [/cdn\.shopify\.com|shopify/i, 'Shopify', true],
      [/wix\.com|wixstatic/i, 'Wix', true],
      [/squarespace/i, 'Squarespace', true],
      [/webflow/i, 'Webflow', true],
      [/drupal/i, 'Drupal', true],
      [/__next_data__|_next\/static/i, 'Next.js', false],
      [/ng-version|angular/i, 'Angular', false],
      [/data-reactroot|react\.|__react/i, 'React', false],
      [/vue(\.min)?\.js|data-v-/i, 'Vue', false],
      [/gatsby/i, 'Gatsby', false],
    ];
    for (const [re, name, isCms] of patterns) {
      if (re.test(lower)) {
        tech.add(name);
        if (isCms && !cms) cms = name;
      }
    }

    return { cms, techStack: Array.from(tech).slice(0, 12) };
  }

  private normalizeUrl(raw: string): string {
    const trimmed = raw.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }
}
