import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

const SINGLETON_KEY = 'analytics';

const BOOLEAN_FIELDS = [
  'enabled',
  'gaEnabled',
  'gtmEnabled',
  'clarityEnabled',
  'facebookPixelEnabled',
] as const;

const STRING_FIELDS = [
  'gaMeasurementId',
  'gaPropertyId',
  'gaServiceAccountEmail',
  'gaServiceAccountPrivateKey',
  'gtmContainerId',
  'clarityProjectId',
  'facebookPixelId',
  'headScript',
  'bodyScript',
] as const;

export interface AnalyticsConfig {
  enabled: boolean;
  gaEnabled: boolean;
  gaMeasurementId: string;
  gaPropertyId: string;
  gaServiceAccountEmail: string;
  gaServiceAccountPrivateKey: string;
  gtmEnabled: boolean;
  gtmContainerId: string;
  clarityEnabled: boolean;
  clarityProjectId: string;
  facebookPixelEnabled: boolean;
  facebookPixelId: string;
  headScript: string;
  bodyScript: string;
  updatedAt?: Date;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel('AnalyticsSetting')
    private readonly analyticsModel: Model<any>,
  ) {}

  private defaults(): AnalyticsConfig {
    return {
      enabled: true,
      gaEnabled: false,
      gaMeasurementId: '',
      gaPropertyId: '',
      gaServiceAccountEmail: '',
      gaServiceAccountPrivateKey: '',
      gtmEnabled: false,
      gtmContainerId: '',
      clarityEnabled: false,
      clarityProjectId: '',
      facebookPixelEnabled: false,
      facebookPixelId: '',
      headScript: '',
      bodyScript: '',
    };
  }

  private normalize(doc: any): AnalyticsConfig {
    const base = this.defaults();
    if (!doc) return base;

    const bool = (value: any, fallback: boolean) =>
      typeof value === 'boolean' ? value : fallback;
    const str = (value: any, fallback: string) =>
      typeof value === 'string' ? value.trim() : fallback;

    return {
      enabled: bool(doc.enabled, base.enabled),
      gaEnabled: bool(doc.gaEnabled, base.gaEnabled),
      gaMeasurementId: str(doc.gaMeasurementId, base.gaMeasurementId),
      gaPropertyId: str(doc.gaPropertyId, base.gaPropertyId),
      gaServiceAccountEmail: str(
        doc.gaServiceAccountEmail,
        base.gaServiceAccountEmail,
      ),
      gaServiceAccountPrivateKey:
        typeof doc.gaServiceAccountPrivateKey === 'string'
          ? doc.gaServiceAccountPrivateKey
          : base.gaServiceAccountPrivateKey,
      gtmEnabled: bool(doc.gtmEnabled, base.gtmEnabled),
      gtmContainerId: str(doc.gtmContainerId, base.gtmContainerId),
      clarityEnabled: bool(doc.clarityEnabled, base.clarityEnabled),
      clarityProjectId: str(doc.clarityProjectId, base.clarityProjectId),
      facebookPixelEnabled: bool(
        doc.facebookPixelEnabled,
        base.facebookPixelEnabled,
      ),
      facebookPixelId: str(doc.facebookPixelId, base.facebookPixelId),
      headScript: str(doc.headScript, base.headScript),
      bodyScript: str(doc.bodyScript, base.bodyScript),
      updatedAt: doc.updatedAt,
    };
  }

  /** Full config used by the admin UI. */
  async getConfig(): Promise<AnalyticsConfig> {
    const doc = await this.analyticsModel
      .findOne({ key: SINGLETON_KEY })
      .lean()
      .exec();
    return this.normalize(doc);
  }

  /**
   * Storefront-facing config. Disabled providers are stripped out entirely so
   * a half-configured integration never leaks to the public site.
   */
  async getPublicConfig(): Promise<Partial<AnalyticsConfig>> {
    const config = await this.getConfig();
    if (!config.enabled) {
      return { enabled: false };
    }

    const publicConfig: Partial<AnalyticsConfig> = { enabled: true };

    if (config.gaEnabled && config.gaMeasurementId) {
      publicConfig.gaMeasurementId = config.gaMeasurementId;
    }
    if (config.gtmEnabled && config.gtmContainerId) {
      publicConfig.gtmContainerId = config.gtmContainerId;
    }
    if (config.clarityEnabled && config.clarityProjectId) {
      publicConfig.clarityProjectId = config.clarityProjectId;
    }
    if (config.facebookPixelEnabled && config.facebookPixelId) {
      publicConfig.facebookPixelId = config.facebookPixelId;
    }
    if (config.headScript) {
      publicConfig.headScript = config.headScript;
    }
    if (config.bodyScript) {
      publicConfig.bodyScript = config.bodyScript;
    }

    return publicConfig;
  }

  async updateConfig(body: Record<string, any>): Promise<AnalyticsConfig> {
    const $set: Record<string, any> = {};

    for (const field of BOOLEAN_FIELDS) {
      if (body?.[field] !== undefined) {
        $set[field] = body[field] === true || body[field] === 'true';
      }
    }

    for (const field of STRING_FIELDS) {
      if (body?.[field] !== undefined) {
        $set[field] = body[field] === null ? '' : String(body[field]).trim();
      }
    }

    $set.key = SINGLETON_KEY;

    const doc = await this.analyticsModel
      .findOneAndUpdate(
        { key: SINGLETON_KEY },
        { $set },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean()
      .exec();

    return this.normalize(doc);
  }
}
