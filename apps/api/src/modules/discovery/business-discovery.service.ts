import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, PrismaService } from '@reachflow/database';

export interface DiscoveredBusiness {
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  category: string;
  osmId: string;
  lat: number | null;
  lon: number | null;
  hasWebsite: boolean;
}

export interface DiscoveryResult {
  location: string;
  category: string;
  count: number;
  businesses: DiscoveredBusiness[];
}

const UA = 'ReachFlowBot/1.0 (lead discovery; contact: hello@reachflow.ai)';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

// Friendly category -> OSM key=value selectors.
const CATEGORY_TAGS: Record<string, string[]> = {
  restaurant: ['amenity=restaurant'],
  cafe: ['amenity=cafe'],
  bakery: ['shop=bakery'],
  bar: ['amenity=bar'],
  hotel: ['tourism=hotel'],
  dentist: ['amenity=dentist', 'healthcare=dentist'],
  doctor: ['amenity=doctors', 'healthcare=doctor'],
  gym: ['leisure=fitness_centre'],
  salon: ['shop=hairdresser', 'shop=beauty'],
  lawyer: ['office=lawyer'],
  accountant: ['office=accountant'],
  real_estate: ['office=estate_agent'],
  car_repair: ['shop=car_repair'],
  florist: ['shop=florist'],
  clothing: ['shop=clothes'],
  electronics: ['shop=electronics'],
  furniture: ['shop=furniture'],
  pharmacy: ['amenity=pharmacy'],
  veterinary: ['amenity=veterinary'],
  agency: ['office=company', 'office=it', 'office=advertising_agency'],
};

export const DISCOVERY_CATEGORIES = Object.keys(CATEGORY_TAGS);

@Injectable()
export class BusinessDiscoveryService {
  private readonly logger = new Logger(BusinessDiscoveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Turn selected discovered businesses into leads (source=DIRECTORY),
   * deduped by OSM id and by company domain. */
  async importAsLeads(workspaceId: string, businesses: DiscoveredBusiness[]) {
    let imported = 0;
    let duplicates = 0;

    for (const b of businesses) {
      const sourceKey = b.osmId;
      const existingLead = await this.prisma.lead.findFirst({
        where: { workspaceId, source: 'DIRECTORY', sourceKey, deletedAt: null },
      });
      if (existingLead) {
        duplicates += 1;
        continue;
      }

      const domain = this.domainFromUrl(b.website);
      let company =
        domain != null
          ? await this.prisma.company.findFirst({ where: { workspaceId, domain, deletedAt: null } })
          : null;

      company ??= await this.prisma.company.create({
        data: {
          workspaceId,
          name: b.name,
          website: b.website,
          domain,
          city: b.address,
          raw: { phone: b.phone, address: b.address, osmId: b.osmId, source: 'osm' } as Prisma.InputJsonValue,
        },
      });

      let contactId: string | null = null;
      if (b.email) {
        const contact = await this.prisma.contact.create({
          data: { workspaceId, companyId: company.id, email: b.email },
        });
        contactId = contact.id;
      }

      await this.prisma.lead.create({
        data: { workspaceId, companyId: company.id, contactId, source: 'DIRECTORY', sourceKey },
      });
      imported += 1;
    }

    return { total: businesses.length, imported, duplicates };
  }

  private domainFromUrl(url: string | null): string | null {
    if (!url) return null;
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  async discover(category: string, location: string, limit = 40): Promise<DiscoveryResult> {
    const tags = CATEGORY_TAGS[category];
    if (!tags) {
      throw new BadRequestException(
        `Unknown category "${category}". Try one of: ${DISCOVERY_CATEGORIES.join(', ')}`,
      );
    }

    const bbox = await this.geocode(location);
    if (!bbox) {
      throw new BadRequestException(`Could not find location "${location}"`);
    }

    const elements = await this.overpass(tags, bbox, limit);
    const seen = new Set<string>();
    const businesses: DiscoveredBusiness[] = [];

    for (const el of elements) {
      const t: Record<string, string> = el.tags ?? {};
      const name = t.name ?? t['name:en'];
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const website = t.website ?? t['contact:website'] ?? t.url ?? null;
      businesses.push({
        name,
        website,
        phone: t.phone ?? t['contact:phone'] ?? null,
        email: t.email ?? t['contact:email'] ?? null,
        address: this.address(t),
        category,
        osmId: `${el.type}/${el.id}`,
        lat: el.lat ?? el.center?.lat ?? null,
        lon: el.lon ?? el.center?.lon ?? null,
        hasWebsite: Boolean(website),
      });
      if (businesses.length >= limit) break;
    }

    return { location, category, count: businesses.length, businesses };
  }

  /** Nominatim geocode -> Overpass bbox (south, west, north, east). */
  private async geocode(location: string): Promise<[number, number, number, number] | null> {
    const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(location)}`;
    const res = await this.getJson(url);
    const first = Array.isArray(res) ? res[0] : null;
    if (!first?.boundingbox) return null;
    // Nominatim boundingbox = [south, north, west, east] (strings)
    const [south, north, west, east] = first.boundingbox.map(Number) as number[];
    return [south!, west!, north!, east!];
  }

  private async overpass(
    tags: string[],
    bbox: [number, number, number, number],
    limit: number,
  ): Promise<OverpassElement[]> {
    const [s, w, n, e] = bbox;
    const selectors = tags
      .map((tag) => {
        const [k, v] = tag.split('=');
        return `  node["${k}"="${v}"](${s},${w},${n},${e});\n  way["${k}"="${v}"](${s},${w},${n},${e});`;
      })
      .join('\n');
    const query = `[out:json][timeout:25];\n(\n${selectors}\n);\nout center tags ${limit + 20};`;

    const res = await this.postForm(OVERPASS, { data: query });
    return Array.isArray(res?.elements) ? (res.elements as OverpassElement[]) : [];
  }

  private address(t: Record<string, string>): string | null {
    const parts = [
      [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '),
      t['addr:city'],
      t['addr:postcode'],
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }

  private async getJson(url: string): Promise<any> {
    return this.withRetry('Geocoding', () =>
      fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } }),
    );
  }

  private async postForm(url: string, body: Record<string, string>): Promise<any> {
    return this.withRetry('Discovery source', () =>
      fetch(url, {
        method: 'POST',
        headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
      }),
    );
  }

  /** Public geocoding/Overpass endpoints are free but flaky — retry a couple
   * of times with backoff before surfacing an error. */
  private async withRetry(label: string, doFetch: () => Promise<Response>): Promise<any> {
    let lastErr = '';
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const res = await doFetch();
        if (res.ok) return await res.json();
        lastErr = `${res.status}`;
        if (res.status !== 429 && res.status < 500) break; // client error → don't retry
      } catch (e) {
        lastErr = e instanceof Error ? e.message : 'network error';
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
    throw new BadRequestException(`${label} is temporarily unavailable (${lastErr}) — try again`);
  }
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}
