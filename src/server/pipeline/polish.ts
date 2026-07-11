/**
 * Deterministic parsers for Polish commerce strings that show up in
 * discovery results and policy pages ("Dostawa 12,99 zł", "Zwroty do 14 dni",
 * "Darmowa dostawa od 199 zł", "W magazynie").
 */

export function parseZl(text: string): number | undefined {
  const m = text.match(/(\d[\d\s]*(?:[.,]\d{1,2})?)\s*(?:zł|pln)/i);
  if (!m) return undefined;
  const n = Number(m[1].replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Text windows around shipping keywords. Policy pages mention many amounts
 * (thresholds, product prices, COD fees); a shipping cost may only be read
 * from text that is actually about shipping.
 */
export function shippingWindows(text: string, radius = 120): string[] {
  const windows: string[] = [];
  const re = /dostaw\w*|wysyłk\w*|wysylk\w*|przesyłk\w*|shipping|delivery|kurier\w*|inpost|paczkomat\w*/gi;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    windows.push(text.slice(Math.max(0, m.index - radius), m.index + m[0].length + radius));
    if (windows.length >= 12) break;
  }
  return windows;
}

const SHIPPING_KEYWORD = /dostaw\w*|wysyłk\w*|wysylk\w*|przesyłk\w*|shipping|delivery|kurier\w*|inpost|paczkomat\w*/gi;

/**
 * Cheapest plausible shipping cost — only amounts whose position in the text
 * is near a shipping keyword (index intersection, so numbers are never
 * truncated by window slicing).
 */
export function parseShippingCost(text: string, radius = 60): number | undefined {
  const keywordIdx = [...text.matchAll(SHIPPING_KEYWORD)].map((m) => m.index ?? 0);
  if (!keywordIdx.length) return undefined;
  const costs = [...text.matchAll(/(\d[\d\s]*(?:[.,]\d{1,2})?)\s*(?:zł|pln)/gi)]
    .filter((m) => keywordIdx.some((k) => Math.abs((m.index ?? 0) - k) <= radius))
    .map((m) => Number(m[1].replace(/\s/g, "").replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n >= 0 && n < 200); // ≥200 zł is a threshold or unrelated amount, not domestic shipping
  return costs.length ? Math.min(...costs) : undefined;
}

export function parseFreeShipping(text: string): boolean {
  return /darmow\w+\s+(dostaw|wysyłk)|free\s+(shipping|delivery)|dostawa\s*:?\s*0\s*zł/i.test(text);
}

export function parseFreeShippingThreshold(text: string): number | undefined {
  const m = text.match(/darmow\w+\s+(?:dostaw\w+|wysyłk\w+)\s+(?:od|powyżej)\s+(\d[\d\s]*(?:[.,]\d{1,2})?)\s*(?:zł|pln)/i);
  if (!m) return undefined;
  const n = Number(m[1].replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export function parseReturnDays(text: string): number | undefined {
  const m = text.match(/zwrot\w*\s+(?:do\s+)?(\d{1,3})\s*dni|(\d{1,3})\s*dni\s+na\s+zwrot|(\d{1,3})[- ]day\s+returns?/i);
  if (!m) return undefined;
  const n = Number(m[1] ?? m[2] ?? m[3]);
  return Number.isFinite(n) ? n : undefined;
}

export function parseInStock(text: string): boolean | undefined {
  // negative first — "niedostępny" contains "dostępny"
  if (/niedostępn\w+|wyprzedan\w+|brak\s+w\s+magazynie|out\s+of\s+stock/i.test(text)) return false;
  if (/w\s+magazynie|dostępn\w+|in\s+stock/i.test(text)) return true;
  return undefined;
}

export function parseDeliveryDays(text: string): [number, number] | undefined {
  let m = text.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s+dni/i);
  if (m) return [Number(m[1]), Number(m[2])];
  m = text.match(/(?:wysyłka|dostawa)\s+(?:w\s+)?(\d{1,2})\s*h/i);
  if (m) return [1, 1];
  m = text.match(/(?:wysyłka|dostawa)\s+(?:w\s+)?(\d{1,2})\s+dni/i);
  if (m) return [1, Number(m[1])];
  return undefined;
}

/** Payment methods commonly listed on PL stores. */
export function parsePaymentMethods(text: string): string[] {
  const found = new Set<string>();
  if (/blik/i.test(text)) found.add("BLIK");
  if (/przelewy24|p24/i.test(text)) found.add("Przelewy24");
  if (/payu/i.test(text)) found.add("PayU");
  if (/paypal/i.test(text)) found.add("PayPal");
  if (/karta|kartą|visa|mastercard|card/i.test(text)) found.add("card");
  if (/pobranie|cash\s+on\s+delivery|\bcod\b/i.test(text)) found.add("COD");
  if (/raty|installment/i.test(text)) found.add("installments");
  if (/apple\s*pay/i.test(text)) found.add("Apple Pay");
  if (/google\s*pay/i.test(text)) found.add("Google Pay");
  return [...found];
}
