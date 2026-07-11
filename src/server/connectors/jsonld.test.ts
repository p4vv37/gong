import { describe, expect, it } from "vitest";
import { extractProductJsonLd } from "./jsonld";

const wrap = (json: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head><body></body></html>`;

describe("extractProductJsonLd", () => {
  it("parses a plain Product with a single Offer", () => {
    const html = wrap({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Test Jacket",
      brand: { "@type": "Brand", name: "Halti" },
      gtin13: "5901234123457",
      offers: {
        "@type": "Offer",
        price: "379.00",
        priceCurrency: "PLN",
        availability: "https://schema.org/InStock",
      },
    });
    const [p] = extractProductJsonLd(html);
    expect(p.name).toBe("Test Jacket");
    expect(p.brand).toBe("Halti");
    expect(p.gtin).toBe("5901234123457");
    expect(p.offers[0]).toMatchObject({ price: 379, priceCurrency: "PLN", availability: "in_stock" });
  });

  it("finds Product inside @graph and handles AggregateOffer nesting", () => {
    const html = wrap({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebSite", name: "shop" },
        {
          "@type": ["Product"],
          name: "Graph Product",
          offers: {
            "@type": "AggregateOffer",
            lowPrice: "99",
            highPrice: "149",
            priceCurrency: "PLN",
            offerCount: 3,
            offers: [{ "@type": "Offer", price: 99, priceCurrency: "PLN", availability: "http://schema.org/OutOfStock" }],
          },
        },
      ],
    });
    const [p] = extractProductJsonLd(html);
    expect(p.name).toBe("Graph Product");
    expect(p.offers[0]).toMatchObject({ lowPrice: 99, highPrice: 149, offerCount: 3 });
    expect(p.offers[1]).toMatchObject({ price: 99, availability: "out_of_stock" });
  });

  it("survives malformed JSON-LD blocks and multiple scripts", () => {
    const html = `<html><head>
      <script type="application/ld+json">{not json at all</script>
      <script type="application/ld+json">${JSON.stringify([{ "@type": "Product", name: "Second", offers: [] }])}</script>
    </head><body></body></html>`;
    const products = extractProductJsonLd(html);
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe("Second");
  });

  it("normalizes comma decimal prices", () => {
    const html = wrap({
      "@type": "Product",
      name: "Comma",
      offers: { "@type": "Offer", price: "149,99", priceCurrency: "PLN" },
    });
    expect(extractProductJsonLd(html)[0].offers[0].price).toBeCloseTo(149.99);
  });
});
