import { describe, expect, it } from "vitest";
import {
  parseDeliveryDays,
  parseFreeShipping,
  parseFreeShippingThreshold,
  parseInStock,
  parsePaymentMethods,
  parseReturnDays,
  parseShippingCost,
  parseZl,
} from "./polish";

describe("polish commerce parsers", () => {
  it("parses zł amounts with comma decimals and spaces", () => {
    expect(parseZl("Dostawa 12,99 zł")).toBeCloseTo(12.99);
    expect(parseZl("1 299,00 zł")).toBeCloseTo(1299);
    expect(parseZl("cena: 476 PLN")).toBe(476);
    expect(parseZl("no price here")).toBeUndefined();
  });

  it("detects free shipping and thresholds", () => {
    expect(parseFreeShipping("Darmowa dostawa dla zamówień")).toBe(true);
    expect(parseFreeShippingThreshold("Darmowa dostawa od 199 zł")).toBe(199);
    expect(parseFreeShippingThreshold("Darmowa wysyłka powyżej 250,00 zł")).toBe(250);
  });

  it("reads shipping cost only from shipping context, cheapest wins", () => {
    const page =
      "Regulamin sklepu. Voucher o wartości 500 zł do wygrania. " +
      "Dostawa kurierem DPD 15,99 zł, paczkomat InPost 12,99 zł. " +
      "Produkt dnia: kurtka za 299 zł.";
    expect(parseShippingCost(page)).toBeCloseTo(12.99);
    // no shipping context at all → undefined, never the random 500
    expect(parseShippingCost("Voucher o wartości 500 zł. Zwroty do 30 dni.")).toBeUndefined();
  });

  it("parses return windows", () => {
    expect(parseReturnDays("Zwroty do 14 dni")).toBe(14);
    expect(parseReturnDays("masz 30 dni na zwrot towaru")).toBe(30);
    expect(parseReturnDays("100-day returns")).toBe(100);
    expect(parseReturnDays("bez informacji")).toBeUndefined();
  });

  it("parses stock hints", () => {
    expect(parseInStock("W magazynie, online")).toBe(true);
    expect(parseInStock("Produkt niedostępny")).toBe(false);
    expect(parseInStock("czerwony XL")).toBeUndefined();
  });

  it("parses delivery windows", () => {
    expect(parseDeliveryDays("dostawa 2-3 dni robocze")).toEqual([2, 3]);
    expect(parseDeliveryDays("wysyłka w 24h")).toEqual([1, 1]);
  });

  it("collects payment methods", () => {
    expect(parsePaymentMethods("Płatność: BLIK, karta Visa, PayU oraz za pobraniem")).toEqual(
      expect.arrayContaining(["BLIK", "card", "PayU", "COD"]),
    );
  });
});
