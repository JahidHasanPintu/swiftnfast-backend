import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { sign } from 'jsonwebtoken';
import { AnalyticsService } from './analytics.service';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DATA_API_BASE = 'https://analyticsdata.googleapis.com/v1beta';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface ReportRange {
  startDate: string;
  endDate: string;
}

interface CachedReport {
  expiresAt: number;
  payload: any;
}

/**
 * Server-side reader for the GA4 Data API. Credentials live in the same
 * analytics settings document the admin edits, so a single place configures
 * both the client-side tag and the reporting integration.
 *
 * Uses a service-account JWT flow (RS256) so no extra SDK dependency is
 * required, and caches both the OAuth token and the report for a few minutes.
 */
@Injectable()
export class GaReportService {
  private readonly logger = new Logger(GaReportService.name);
  private tokenCache: {
    email: string;
    token: string;
    expiresAt: number;
  } | null = null;
  private readonly reportCache = new Map<string, CachedReport>();

  constructor(private readonly analyticsService: AnalyticsService) {}

  private toYmd(value: string | Date): string {
    // Already a `YYYY-MM-DD` calendar date: keep it as-is so timezone
    // conversions never shift the day the admin picked.
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private resolveRange(opts: {
    startDate?: string;
    endDate?: string;
    days?: number;
  }): ReportRange & { days: number } {
    const days =
      opts.days && Number.isFinite(Number(opts.days)) && Number(opts.days) > 0
        ? Math.min(Number(opts.days), 365)
        : 28;

    const end = opts.endDate ? new Date(opts.endDate) : new Date();
    const start = opts.startDate
      ? new Date(opts.startDate)
      : new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid analytics date range');
    }

    return {
      startDate: this.toYmd(start),
      endDate: this.toYmd(end),
      days,
    };
  }

  private normalizePrivateKey(raw: string): string {
    const key = (raw || '').trim();
    return key.includes('\\n') ? key.replace(/\\n/g, '\n') : key;
  }

  private async getAccessToken(
    email: string,
    privateKey: string,
  ): Promise<string> {
    if (
      this.tokenCache &&
      this.tokenCache.email === email &&
      this.tokenCache.expiresAt > Date.now() + 60 * 1000
    ) {
      return this.tokenCache.token;
    }

    const now = Math.floor(Date.now() / 1000);
    let assertion: string;
    try {
      assertion = sign(
        {
          iss: email,
          scope: SCOPE,
          aud: TOKEN_URL,
          iat: now,
          exp: now + 3600,
        },
        this.normalizePrivateKey(privateKey),
        { algorithm: 'RS256' },
      );
    } catch (error: any) {
      this.logger.error(`Failed to sign GA service-account JWT: ${error?.message}`);
      throw new BadRequestException(
        'Invalid Google service account private key. Paste the full private_key value including BEGIN/END lines.',
      );
    }

    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    });

    try {
      const { data } = await axios.post(TOKEN_URL, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      });

      const token = data?.access_token;
      if (!token) {
        throw new Error('Google token endpoint returned no access_token');
      }

      const expiresIn = Number(data?.expires_in) || 3600;
      this.tokenCache = {
        email,
        token,
        expiresAt: Date.now() + expiresIn * 1000,
      };
      return token;
    } catch (error: any) {
      const message =
        error?.response?.data?.error_description ||
        error?.response?.data?.error ||
        error?.message ||
        'Unable to authenticate with Google Analytics';
      this.logger.error(`GA token request failed: ${message}`);
      throw new BadRequestException(
        `Google Analytics authentication failed: ${message}`,
      );
    }
  }

  private async runReport(
    propertyId: string,
    token: string,
    body: Record<string, any>,
  ): Promise<any> {
    try {
      const { data } = await axios.post(
        `${DATA_API_BASE}/properties/${encodeURIComponent(propertyId)}:runReport`,
        body,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 20000,
        },
      );
      return data;
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.message ||
        'Google Analytics report request failed';
      this.logger.error(`GA report failed: ${message}`);
      throw new BadRequestException(`Google Analytics: ${message}`);
    }
  }

  private metric(row: any, index: number): number {
    return Number(row?.metricValues?.[index]?.value || 0);
  }

  private rowValue(row: any, index = 0): string {
    return row?.dimensionValues?.[index]?.value || '';
  }

  async getOverview(opts: {
    startDate?: string;
    endDate?: string;
    days?: number;
  }) {
    const config = await this.analyticsService.getConfig();

    const propertyId = (config.gaPropertyId || '').trim();
    const email = (config.gaServiceAccountEmail || '').trim();
    const privateKey = config.gaServiceAccountPrivateKey || '';

    if (!propertyId || !email || !privateKey) {
      return {
        configured: false,
        message:
          'Add your GA4 Property ID and service account credentials in Settings → Analytics & Tracking to see website data here.',
      };
    }

    if (!/^\d+$/.test(propertyId)) {
      return {
        configured: false,
        message:
          'GA4 Property ID must be the numeric property ID (not the G- measurement ID).',
      };
    }

    const range = this.resolveRange(opts);
    const cacheKey = `${propertyId}:${range.startDate}:${range.endDate}`;
    const cached = this.reportCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }

    const token = await this.getAccessToken(email, privateKey);

    const dateRanges = [
      { startDate: range.startDate, endDate: range.endDate },
    ];

    const [
      timeseriesReport,
      totalsReport,
      pagesReport,
      channelsReport,
      devicesReport,
      countriesReport,
    ] = await Promise.all([
      this.runReport(propertyId, token, {
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        keepEmptyRows: true,
      }),
      this.runReport(propertyId, token, {
        dateRanges,
        metrics: [
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'conversions' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
        ],
      }),
      this.runReport(propertyId, token, {
        dateRanges,
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'sessions' },
        ],
        orderBys: [
          { metric: { metricName: 'screenPageViews' }, desc: true },
        ],
        limit: 10,
      }),
      this.runReport(propertyId, token, {
        dateRanges,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      }),
      this.runReport(propertyId, token, {
        dateRanges,
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      }),
      this.runReport(propertyId, token, {
        dateRanges,
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      }),
    ]);

    const totalsRow = totalsReport?.totals?.[0] || totalsReport?.rows?.[0];
    const totals = {
      activeUsers: this.metric(totalsRow, 0),
      newUsers: this.metric(totalsRow, 1),
      sessions: this.metric(totalsRow, 2),
      screenPageViews: this.metric(totalsRow, 3),
      conversions: this.metric(totalsRow, 4),
      engagementRate: this.metric(totalsRow, 5),
      averageSessionDuration: this.metric(totalsRow, 6),
      bounceRate: this.metric(totalsRow, 7),
    };

    const timeseries = (timeseriesReport?.rows || []).map((row: any) => {
      const rawDate = this.rowValue(row);
      const date =
        rawDate.length === 8
          ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
          : rawDate;
      return {
        date,
        activeUsers: this.metric(row, 0),
        newUsers: this.metric(row, 1),
        sessions: this.metric(row, 2),
        screenPageViews: this.metric(row, 3),
      };
    });

    const topPages = (pagesReport?.rows || []).map((row: any) => ({
      page: this.rowValue(row),
      views: this.metric(row, 0),
      users: this.metric(row, 1),
      sessions: this.metric(row, 2),
    }));

    const channels = (channelsReport?.rows || []).map((row: any) => ({
      channel: this.rowValue(row) || 'Unassigned',
      sessions: this.metric(row, 0),
      users: this.metric(row, 1),
    }));

    const devices = (devicesReport?.rows || []).map((row: any) => ({
      device: this.rowValue(row) || 'unknown',
      users: this.metric(row, 0),
      sessions: this.metric(row, 1),
    }));

    const countries = (countriesReport?.rows || []).map((row: any) => ({
      country: this.rowValue(row) || 'Unknown',
      users: this.metric(row, 0),
      sessions: this.metric(row, 1),
    }));

    const payload = {
      configured: true,
      propertyId,
      range: {
        startDate: range.startDate,
        endDate: range.endDate,
        days: range.days,
      },
      totals,
      timeseries,
      topPages,
      channels,
      devices,
      countries,
      fetchedAt: new Date().toISOString(),
    };

    this.reportCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return payload;
  }
}
