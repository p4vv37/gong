import type { DecisionQuestion } from "./purchase-brief";

export const clothingQuestions: DecisionQuestion[] = [
  {
    id: "use",
    eyebrow: "Use case",
    title: "Where does this need to perform?",
    why: "Use changes which materials, construction and compromises are actually relevant.",
    choices: [
      { id: "daily", label: "Everyday", consequence: "Comfort and versatility lead.", criterion: { label: "Use", value: "Everyday versatility", kind: "prefer" } },
      { id: "occasion", label: "A specific occasion", consequence: "Appearance can outweigh easy care.", criterion: { label: "Use", value: "Occasion-focused", kind: "prefer" } },
      { id: "technical", label: "Technical / outdoors", consequence: "Performance becomes a hard requirement.", criterion: { label: "Use", value: "Technical performance", kind: "must" } },
      { id: "delegate", label: "Decide for me", consequence: "We will infer this from the original request.", criterion: { label: "Use", value: "Agent may decide", kind: "delegate" } },
    ],
  },
  {
    id: "fit",
    eyebrow: "Fit & silhouette",
    title: "How should it sit on the body?",
    why: "Fit is often a bigger source of returns than fabric or brand.",
    choices: [
      { id: "relaxed", label: "Relaxed", consequence: "More movement and easier layering.", criterion: { label: "Fit", value: "Relaxed", kind: "prefer" } },
      { id: "regular", label: "Regular", consequence: "Balanced and broadly wearable.", criterion: { label: "Fit", value: "Regular", kind: "prefer" } },
      { id: "fitted", label: "Fitted", consequence: "Sharper silhouette; sizing becomes more sensitive.", criterion: { label: "Fit", value: "Fitted", kind: "prefer" } },
      { id: "indifferent", label: "No preference", consequence: "Fit will not drive ranking.", criterion: { label: "Fit", value: "No preference", kind: "indifferent" } },
    ],
  },
  {
    id: "care",
    eyebrow: "Materials & ownership",
    title: "How much maintenance is acceptable?",
    why: "A great-looking item can be a bad recommendation if cleaning, durability or fabric feel is wrong.",
    choices: [
      { id: "easy", label: "Easy care only", consequence: "Machine-washable and robust options rank higher.", criterion: { label: "Care", value: "Easy care", kind: "must" } },
      { id: "natural", label: "Prefer natural fibres", consequence: "Fibre content matters more than convenience.", criterion: { label: "Materials", value: "Natural fibres", kind: "prefer" } },
      { id: "performance", label: "Performance fabrics", consequence: "Weather and activity properties lead.", criterion: { label: "Materials", value: "Performance fabrics", kind: "prefer" } },
      { id: "delegate", label: "Use your judgment", consequence: "We will balance feel, care and durability.", criterion: { label: "Materials", value: "Agent may decide", kind: "delegate" } },
    ],
  },
  {
    id: "product-reviews",
    eyebrow: "Product evidence",
    title: "How should customer reviews affect the choice?",
    why: "Reviews can reveal sizing, wear and defects that specifications cannot—but volume, recency and manipulation risk matter.",
    choices: [
      { id: "proven", label: "Proven products", consequence: "Prefer substantial, recent review history.", criterion: { label: "Product reviews", value: "Strong review evidence required", kind: "must" } },
      { id: "signal", label: "Use as a signal", consequence: "Reviews influence confidence, not eligibility.", criterion: { label: "Product reviews", value: "Use as weighted evidence", kind: "prefer" } },
      { id: "open", label: "Open to unreviewed", consequence: "New or niche products remain competitive.", criterion: { label: "Product reviews", value: "Low review volume acceptable", kind: "indifferent" } },
    ],
  },
  {
    id: "merchant-risk",
    eyebrow: "Store & seller risk",
    title: "How cautious should we be about the seller?",
    why: "Store reviews, return friction, marketplace seller identity and payment protection can outweigh a small price difference.",
    choices: [
      { id: "strict", label: "Low risk only", consequence: "Established sellers and buyer protection are required.", criterion: { label: "Seller risk", value: "Low risk only", kind: "must" } },
      { id: "balanced", label: "Balance price and trust", consequence: "Some uncertainty is acceptable for meaningful savings.", criterion: { label: "Seller risk", value: "Balanced", kind: "prefer" } },
      { id: "adventurous", label: "Show risky bargains", consequence: "We may include them, clearly flagged.", criterion: { label: "Seller risk", value: "Risk accepted when disclosed", kind: "prefer" } },
    ],
  },
  {
    id: "style",
    eyebrow: "Style direction",
    title: "Should the result blend in or make a point?",
    why: "This narrows colour, branding and silhouette without forcing dozens of filters.",
    choices: [
      { id: "quiet", label: "Quiet & versatile", consequence: "Neutral, low-branding options lead.", criterion: { label: "Style", value: "Quiet and versatile", kind: "prefer" } },
      { id: "distinctive", label: "Distinctive", consequence: "Unusual colour or silhouette is welcome.", criterion: { label: "Style", value: "Distinctive", kind: "prefer" } },
      { id: "specific", label: "I have a specific idea", consequence: "Describe it below.", criterion: { label: "Style", value: "Custom direction", kind: "prefer" } },
      { id: "delegate", label: "Surprise me", consequence: "We retain freedom on style.", criterion: { label: "Style", value: "Agent may decide", kind: "delegate" } },
    ],
  },
  {
    id: "tradeoff",
    eyebrow: "Final trade-off",
    title: "What should win when no option is perfect?",
    why: "At high depth we make the ranking philosophy explicit instead of hiding it in a prompt.",
    choices: [
      { id: "quality", label: "Quality", consequence: "Construction and longevity beat small savings.", criterion: { label: "Tie-breaker", value: "Quality and longevity", kind: "prefer" } },
      { id: "value", label: "Value", consequence: "The strongest benefit per złoty wins.", criterion: { label: "Tie-breaker", value: "Value", kind: "prefer" } },
      { id: "match", label: "Exact match", consequence: "Preference fit wins even at a premium.", criterion: { label: "Tie-breaker", value: "Exact preference match", kind: "prefer" } },
    ],
  },
];

export function questionsForDepth(depth: number) {
  const count = depth <= 25 ? 3 : depth <= 65 ? 5 : 7;
  return clothingQuestions.slice(0, count);
}
