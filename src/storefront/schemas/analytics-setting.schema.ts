import * as mongoose from 'mongoose';

/**
 * Singleton document holding every analytics/tag-manager credential the
 * storefront needs. Managed from the admin UI; read by the storefront at
 * render time so credentials never need an env change or redeploy.
 */
export const AnalyticsSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'analytics' },
    enabled: { type: Boolean, default: true },

    gaEnabled: { type: Boolean, default: false },
    gaMeasurementId: { type: String, default: '', trim: true },

    // Google Analytics 4 Data API (server-side reporting). The property ID is
    // the numeric GA4 property, not the G- measurement ID above.
    gaPropertyId: { type: String, default: '', trim: true },
    gaServiceAccountEmail: { type: String, default: '', trim: true },
    gaServiceAccountPrivateKey: { type: String, default: '' },

    gtmEnabled: { type: Boolean, default: false },
    gtmContainerId: { type: String, default: '', trim: true },

    clarityEnabled: { type: Boolean, default: false },
    clarityProjectId: { type: String, default: '', trim: true },

    facebookPixelEnabled: { type: Boolean, default: false },
    facebookPixelId: { type: String, default: '', trim: true },

    headScript: { type: String, default: '' },
    bodyScript: { type: String, default: '' },
  },
  { timestamps: true, collection: 'analytics_settings' },
);

AnalyticsSettingSchema.index({ key: 1 }, { unique: true });

export default AnalyticsSettingSchema;
