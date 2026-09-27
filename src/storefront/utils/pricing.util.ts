/**
 * Canonical outside-order pricing.
 *
 *   USA item : (price * (1 + taxPct/100)) * usd_rate
 *   UK item  : price * gbp_rate                      (no sales tax)
 *
 * `usaSalesTax` is stored as a PERCENTAGE RATE (e.g. 10 = 10%), not a money
 * amount. When it is absent the DEFAULT_USA_TAX_PCT default applies. Only USA
 * items are taxed; every other source is tax-free.
 *
 * Shipping is converted with the rate but is never taxed.
 *
 * The admin-supplied `finalPrice` is a PER-UNIT BDT value that already has tax
 * baked in, so when present it wins outright and tax is not applied again.
 */

/** Default USA sales tax rate (%). */
export const DEFAULT_USA_TAX_PCT = 10;

/** Setting keys for the DB-managed exchange rates. */
export const RATE_SETTING_KEYS: Record<string, string> = {
  USA: 'usd_rate',
  UK: 'gbp_rate',
  UAE: 'aed_rate',
};

export type SettingLookup = (key: string) => Promise<any>;

/**
 * Resolve a country's exchange rate from the admin-managed Settings collection
 * (usd_rate / gbp_rate / aed_rate). Falls back to 1 for unknown sources or
 * missing/invalid settings, matching the storefront settingsStore default so
 * stored totals align with what the customer saw at checkout.
 */
export async function resolveRate(
  source: string | null | undefined,
  getByKey: SettingLookup,
  fallback = 1,
): Promise<number> {
  const key =
    RATE_SETTING_KEYS[
      String(source || '')
        .trim()
        .toUpperCase()
    ] || '';
  if (!key) return fallback;
  let setting: any = null;
  try {
    setting = await getByKey(key);
  } catch {
    setting = null;
  }
  const val = setting?.value != null ? parseFloat(String(setting.value)) : NaN;
  if (!Number.isFinite(val) || val <= 0) return fallback;
  return val;
}

/**
 * Effective sales tax rate (percentage) for a source country.
 * Returns 0 for anything that is not USA.
 */
export function taxRatePct(
  source: string | null | undefined,
  storedTaxRate: number | string | null | undefined,
): number {
  if (!source || String(source).trim().toUpperCase() !== 'USA') return 0;
  const stored = parseFloat(String(storedTaxRate ?? ''));
  return Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_USA_TAX_PCT;
}

export interface BdtItem {
  type?: string;
  price?: string | number | null;
  quantity?: string | number | null;
  finalPrice?: string | number | null;
  priceManuallyUpdated?: boolean;
  usaSalesTax?: number | string | null;
  shippingCost?: number | string | null;
  productSourcedFrom?: string | null;
}

function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Whether the item is an outside/import order (vs. a pre-stock product). */
export function isOutsideOrder(item: BdtItem): boolean {
  return (item?.type || 'product') === 'outside_order';
}

/**
 * Per-unit BDT for an item.
 * Pre-stock items stay raw BDT; outside orders are converted with the rate and
 * taxed only when the source is USA.
 */
export function unitBdt(
  item: BdtItem,
  rate: number,
  opts: { useManualFinalPrice?: boolean } = {},
): number {
  if (!isOutsideOrder(item)) return toNum(item?.price);

  if (opts.useManualFinalPrice !== false && item?.priceManuallyUpdated) {
    const manual = toNum(item?.finalPrice);
    if (manual > 0) return manual;
  }

  const source = String(item?.productSourcedFrom || '').trim();
  if (!source) return toNum(item?.price);

  const pct = taxRatePct(source, item?.usaSalesTax);
  return toNum(item?.price) * (1 + pct / 100) * rate;
}

/** Per-unit BDT for shipping. Converted with the rate, never taxed. */
export function shippingBdt(item: BdtItem, rate: number): number {
  if (!isOutsideOrder(item)) return toNum(item?.shippingCost);
  const source = String(item?.productSourcedFrom || '').trim();
  if (!source) return toNum(item?.shippingCost);
  return toNum(item?.shippingCost) * rate;
}

/** Full line total in BDT with quantity applied. */
export function lineBdt(item: BdtItem, rate: number): number {
  const qty = toNum(item?.quantity) || 1;
  return (unitBdt(item, rate) + shippingBdt(item, rate)) * qty;
}
