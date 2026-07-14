import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { chromium, type Page } from 'playwright';
import type { DiscoveredBusiness, DiscoveryResult } from './business-discovery.service';

const DEFAULT_TIMEOUT = 30_000;
const MAX_RESULTS = 25;

@Injectable()
export class GoogleMapsDiscoveryService {
  private readonly logger = new Logger(GoogleMapsDiscoveryService.name);

  /**
   * Extract public business listing details from a Google Maps search.  This is
   * deliberately low-concurrency: one browser, one page, small pauses between
   * listings.  Maps markup changes regularly, so failures are returned as an
   * actionable error rather than silently importing partial/incorrect data.
   */
  async discover(category: string, location: string, requestedLimit = 20): Promise<DiscoveryResult> {
    const limit = Math.min(requestedLimit, MAX_RESULTS);
    const query = `${category.replace(/_/g, ' ')} in ${location}`;
    const browser = await this.launchBrowser();

    try {
      const context = await browser.newContext({
        locale: 'en-US',
        viewport: { width: 1440, height: 900 },
      });
      const page = await context.newPage();
      page.setDefaultTimeout(DEFAULT_TIMEOUT);
      await page.route('**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2}', (route) => route.abort());

      await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, {
        waitUntil: 'domcontentloaded',
        timeout: DEFAULT_TIMEOUT,
      });
      await this.acceptConsent(page);
      await page.waitForSelector('div[role="feed"]', { timeout: 15_000 });
      await this.scrollResults(page, limit);

      const urls = await page.$$eval('a[href*="/maps/place/"]', (links) =>
        [...new Set(links.map((link) => link.getAttribute('href')).filter((href): href is string => Boolean(href)))],
      );
      const businesses: DiscoveredBusiness[] = [];
      const seen = new Set<string>();

      for (const url of urls.slice(0, limit)) {
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT });
          await page.waitForSelector('h1', { timeout: 8_000 });
          const business = await this.extractBusiness(page, category);
          if (!business || seen.has(business.osmId)) continue;
          seen.add(business.osmId);
          businesses.push(business);
          await page.waitForTimeout(700);
        } catch (error) {
          this.logger.warn(`Skipped a Google Maps listing: ${this.message(error)}`);
        }
      }

      await context.close();
      return { location, category, count: businesses.length, businesses };
    } catch (error) {
      throw new ServiceUnavailableException(`Google Maps discovery failed: ${this.message(error)}`);
    } finally {
      await browser.close();
    }
  }

  private async launchBrowser() {
    try {
      return await chromium.launch({
        headless: process.env.GOOGLE_MAPS_HEADLESS !== 'false',
        args: ['--disable-dev-shm-usage'],
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        `Chromium is unavailable. Install it with: npx playwright install chromium (${this.message(error)})`,
      );
    }
  }

  private async acceptConsent(page: Page): Promise<void> {
    const button = page.getByRole('button', { name: /accept all|i agree/i }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => undefined);
      await page.waitForTimeout(500);
    }
  }

  private async scrollResults(page: Page, limit: number): Promise<void> {
    let previous = 0;
    let unchanged = 0;
    for (let index = 0; index < 15; index += 1) {
      const count = await page.locator('a[href*="/maps/place/"]').count();
      if (count >= limit) return;
      if (count === previous) unchanged += 1;
      else unchanged = 0;
      if (unchanged >= 3) return;
      previous = count;
      const feed = page.locator('div[role="feed"]');
      await feed.hover();
      await page.mouse.wheel(0, 2400);
      await page.waitForTimeout(700);
    }
  }

  private async extractBusiness(page: Page, requestedCategory: string): Promise<DiscoveredBusiness | null> {
    const text = async (selector: string): Promise<string | null> =>
      (await page.locator(selector).first().textContent().catch(() => null))?.trim() || null;
    const attr = async (selector: string, name: string): Promise<string | null> =>
      (await page.locator(selector).first().getAttribute(name).catch(() => null))?.trim() || null;
    const rawAddress = (await attr('[data-item-id="address"]', 'aria-label')) ?? (await text('[data-item-id="address"]'));
    const rawPhone = (await attr('[data-item-id^="phone:"]', 'aria-label')) ?? (await text('[data-item-id^="phone:"]'));
    const ratingLabel = await attr('span[role="img"]', 'aria-label');
    const ratingMatch = ratingLabel?.match(/([0-5](?:\.\d)?)/);
    const reviewsMatch = ratingLabel?.match(/([\d,]+)\s+reviews?/i);
    const data = {
      name: await text('h1'),
      address: rawAddress?.replace(/^Address:\s*/i, '') ?? null,
      phone: rawPhone?.replace(/^Phone:\s*/i, '') ?? null,
      website: await attr('a[data-item-id="authority"]', 'href'),
      category: await text('button[jsaction*="category"]'),
    };
    if (!data.name) return null;

    const mapsUrl = page.url();
    return {
      name: data.name,
      website: data.website,
      phone: data.phone,
      email: null,
      address: data.address,
      category: data.category || requestedCategory,
      // Existing import pipeline uses this field as a stable source key. Keep
      // its wire name for compatibility while using a Google Maps-derived key.
      osmId: `google:${createHash('sha256').update(mapsUrl).digest('hex').slice(0, 32)}`,
      lat: null,
      lon: null,
      hasWebsite: Boolean(data.website),
      mapsUrl,
      rating: ratingMatch ? Number(ratingMatch[1]) : null,
      reviewCount: reviewsMatch?.[1] ? Number(reviewsMatch[1].replace(/,/g, '')) : null,
    };
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
