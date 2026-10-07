/**
 * Canonical outside-order pricing (mirrors pfu2-frontend/src/utils/pricing.ts).
 *
 *   USA item : ceil((price + price * taxPct/100) * usd_rate)  -> BDT
 *   UK item  : ceil(price * gbp_rate)                         -> BDT
 *   others   : ceil(price * rate)                             -> BDT
 *
 * The entered price may be fractional (39.5, 1.2, ...) and is taxed/converted
 * as-is; only the resulting BDT figure is rounded UP to the next whole unit, so
 * every per-unit figure is whole BDT and the customer, admin and backend never
 * disagree. Mirrors calculatePrice() in storefront-orders.service.ts.
 *
 * Ceiling is per-unit; quantity multiplies the finished unit price, so a qty of
 * 3 costs exactly 3x one unit (never a re-rounded line total).
 *
 * `usaSalesTax` is stored as a PERCENTAGE RATE (e.g. 10 = 10%), not a money
 * amount. When it is absent the DEFAULT_USA_TAX_PCT default applies. Only USA
 * items are taxed; every other source is tax-free.
 *
 * Shipping is converted with the rate, never taxed, and ceiled like any other
 * BDT figure. It is a FLAT per-line charge: quantity does not multiply it, so
 * one line of qty 1 and one line of qty 5 with the same shippingCost pay the
 * same shipping.
 *
 * Pre-stock (`type !== "outside_order"`) items are already denominated in BDT,
 * so there is nothing to convert or ceil - they pass through untouched.
 *
 * The admin-supplied `finalPrice` is a PER-UNIT BDT value that already has tax
 * baked in, so when present it wins outright, is trusted exactly as typed (never
 * ceiled or re-derived), and tax is reported as 0 because the split is
 * unknowable.
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

/**
 * Round a value UP to the next whole unit.
 *
 * `ceilToWhole(40) === 40`; `ceilToWhole(39.5) === 40`; `ceilToWhole(1.2) === 2`.
 * Non-positive / non-finite input collapses to 0 so a blank or malformed value
 * can never leak a negative into a total.
 */
export function ceilToWhole(value: any): number {
  const n = toNum(value);
  return n <= 0 ? 0 : Math.ceil(n);
}

/** Whether the item is an outside/import order (vs. a pre-stock product). */
export function isOutsideOrder(item: BdtItem): boolean {
  return (item?.type || 'product') === 'outside_order';
}

/**
 * Per-unit BDT BEFORE sales tax - product price alone, converted and ceiled.
 *
 * Counterpart to `unitBdt`: the difference between the two is exactly the tax
 * charged on one unit, which is what lets the summary list price and tax
 * separately. An admin `finalPrice` is trusted verbatim on both sides, so its
 * tax split resolves to 0.
 */
export function baseUnitBdt(
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

  return ceilToWhole(toNum(item?.price) * rate);
}

/**
 * Per-unit BDT, tax included, shipping excluded.
 *
 * Pipeline: (price + USA sales tax) * rate, then ceil the BDT result. Pre-stock
 * items are already BDT and pass through.
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
  return ceilToWhole(toNum(item?.price) * (1 + pct / 100) * rate);
}

/** Per-unit BDT for shipping. Converted with the rate, never taxed, ceiled. */
export function shippingBdt(item: BdtItem, rate: number): number {
  if (!isOutsideOrder(item)) return toNum(item?.shippingCost);
  const source = String(item?.productSourcedFrom || '').trim();
  if (!source) return toNum(item?.shippingCost);
  return ceilToWhole(toNum(item?.shippingCost) * rate);
}

/** Sales tax on one unit, in BDT. Never negative. */
export function unitTaxBdt(item: BdtItem, rate: number): number {
  return Math.max(0, unitBdt(item, rate) - baseUnitBdt(item, rate));
}

/** Full line total in BDT with quantity applied. Shipping is a flat, per-line
 * charge, so it is added once and never multiplied by quantity. */
export function lineBdt(item: BdtItem, rate: number): number {
  const qty = toNum(item?.quantity) || 1;
  return unitBdt(item, rate) * qty + shippingBdt(item, rate);
}

export interface ItemMoneyBreakdown {
  /** Final BDT per unit, tax INCLUDED, shipping EXCLUDED. */
  priceBdt: number;
  /** The same price with tax stripped out, BDT. Show this as "Product price". */
  basePriceBdt: number;
  /** The tax portion of `priceBdt`, in BDT. 0 for admin-set finalPrice. */
  taxBdt: number;
  /** Shipping converted to BDT, never taxed. Flat per line (not per unit). */
  shippingBdt: number;
  /** Whole-line total: (priceBdt x quantity) + shippingBdt. */
  lineTotalBdt: number;
}

/**
 * Resolve the per-unit money breakdown for an item, preferring the values the
 * backend stamped onto it and falling back to live computation for cart rows
 * written before those fields existed. Keeping the fallback means old carts
 * need no migration and still price identically.
 *
 * Invariant: `priceBdt === basePriceBdt + taxBdt`, so a summary can render
 * "Product price" (basePriceBdt), "Sales tax" (taxBdt) and "Total"
 * (basePriceBdt + taxBdt) without double-counting.
 */
export function breakdownBdt(item: BdtItem, rate: number): ItemMoneyBreakdown {
  const qty = toNum(item?.quantity) || 1;

  const storedPrice = toNum((item as any)?.priceBdt);
  const storedShipping = toNum((item as any)?.shippingBdt);
  const hasStored = storedPrice > 0 || storedShipping > 0;

  const priceBdt = hasStored ? storedPrice : unitBdt(item, rate);
  const ship = hasStored ? storedShipping : shippingBdt(item, rate);
  const basePriceBdt = hasStored
    ? priceBdt - toNum((item as any)?.taxBdt)
    : baseUnitBdt(item, rate);
  const taxBdt = priceBdt - basePriceBdt;

  return {
    priceBdt,
    basePriceBdt,
    taxBdt,
    shippingBdt: ship,
    lineTotalBdt: priceBdt * qty + ship,
  };
}

/**
 * Compute (but do not persist) the money fields to stamp onto a cart item.
 * Returns a plain patch object; callers merge it into the item document.
 *
 * IMPORTANT: this always RE-DERIVES from the item's current price/tax/rate. It
 * must never consult the priceBdt already stored on the item - that value is
 * the thing being overwritten, and reading it back here is what used to freeze
 * an item on its first stamped price so a later admin edit never took effect.
 * (`breakdownBdt` prefers the stored value because it is a READ-path helper.)
 */
export function moneyFieldsFor(item: BdtItem, rate: number) {
  const priceBdt = unitBdt(item, rate);
  const basePriceBdt = baseUnitBdt(item, rate);
  return {
    priceBdt,
    taxBdt: Math.max(0, priceBdt - basePriceBdt),
    shippingBdt: shippingBdt(item, rate),
  };
}
