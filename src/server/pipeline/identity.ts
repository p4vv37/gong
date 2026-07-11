import type { Product } from "../../contract";
import { llmEnabled } from "../agents/client";
import { normalizeTitle } from "./ids";
import type { Emit } from "./run-helpers";
import type { RunState } from "./state";

/**
 * Cross-source product identity: the same item is often titled differently
 * in different shops ("Quechua MH500 Light wodoodporna" vs "Kurtka Quechua
 * MH500"), so it lands as two products and cross-store price comparison
 * breaks. Resolution: cheap stem-overlap clustering proposes candidate
 * groups, an LLM confirms which candidates are truly the SAME product
 * (keyless runs merge only near-certain pairs), then offers are re-pointed
 * at the canonical product.
 */

const stems = (p: Product): Set<string> =>
  new Set(normalizeTitle(`${p.brand ?? ""} ${p.title}`).split(" ").filter(Boolean).map((t) => t.slice(0, 5)));

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/** union-find over products with similarity above the clustering threshold */
function proposeClusters(products: Product[], threshold: number): Product[][] {
  const parent = products.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const tokenSets = products.map(stems);

  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      // GTIN mismatch is a hard "different product" signal
      if (products[i].gtin && products[j].gtin && products[i].gtin !== products[j].gtin) continue;
      if (jaccard(tokenSets[i], tokenSets[j]) >= threshold) parent[find(i)] = find(j);
    }
  }

  const groups = new Map<number, Product[]>();
  products.forEach((p, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), p]);
  });
  return [...groups.values()].filter((g) => g.length > 1);
}

function mergeInto(state: RunState, canonical: Product, duplicate: Product): void {
  if (canonical.id === duplicate.id) return;
  canonical.brand ??= duplicate.brand;
  canonical.gtin ??= duplicate.gtin;
  canonical.mpn ??= duplicate.mpn;
  canonical.imageUrl ??= duplicate.imageUrl;
  for (const fact of duplicate.specs) {
    if (!canonical.specs.some((f) => f.aspectId === fact.aspectId)) canonical.specs.push(fact);
  }
  for (const offer of state.offers.values()) {
    if (offer.productId === duplicate.id) offer.productId = canonical.id;
  }
  for (const variant of state.variants.values()) {
    if (variant.productId === duplicate.id) variant.productId = canonical.id;
  }
  for (const review of state.reviews) {
    if (review.subject === "product" && review.subjectId === duplicate.id) review.subjectId = canonical.id;
  }
  state.products.delete(duplicate.id);
}

const canonicalOf = (group: Product[]): Product =>
  [...group].sort((a, b) => b.specs.length - a.specs.length || (b.gtin ? 1 : 0) - (a.gtin ? 1 : 0) || b.title.length - a.title.length)[0];

export async function resolveIdentity(state: RunState, emit: Emit): Promise<void> {
  const products = [...state.products.values()];
  if (products.length < 2) return;

  // near-certain duplicates merge without an LLM
  for (const group of proposeClusters(products, 0.85)) {
    const canonical = canonicalOf(group);
    for (const dup of group) mergeInto(state, canonical, dup);
  }

  if (!llmEnabled()) return;

  // looser candidates go to the judge
  const candidates = proposeClusters([...state.products.values()], 0.45);
  if (!candidates.length) return;

  try {
    const { judgeIdentity } = await import("../agents/identity-judge");
    const confirmed = await judgeIdentity(candidates);
    let merged = 0;
    for (const group of confirmed) {
      const members = group.map((id) => state.products.get(id)).filter((p): p is Product => Boolean(p));
      if (members.length < 2) continue;
      const canonical = canonicalOf(members);
      for (const dup of members) mergeInto(state, canonical, dup);
      merged += members.length - 1;
    }
    if (merged) {
      emit({
        type: "source_searched",
        channel: "serpapi",
        label: `Matched ${merged} duplicate listing${merged > 1 ? "s" : ""} of the same product across stores`,
      });
    }
  } catch (err) {
    emit({ type: "warning", detail: String(err), label: "Product matching unavailable — listings stay separate" });
  }
}
