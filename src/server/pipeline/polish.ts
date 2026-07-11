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
