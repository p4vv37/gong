import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Agent, run, RunState, tool } from "@openai/agents";
import { z } from "zod";
import type { CheckoutProposal } from "../../contract";
import { llmEnabled, MODELS } from "./client";

/**
 * The consent gate as an Agents SDK human-in-the-loop interruption:
 * `finalize_purchase` has needsApproval, so the run PAUSES before the tool
 * executes, the RunState is serialized next to the proposal, and only an
 * explicit user decision resumes (approve) or rejects it. Keyless fallback
 * places the mock order directly — consent semantics are identical.
 */

export type OrderRecord = {
  orderId: string;
  proposalId: string;
  merchant: string;
  offerUrl: string;
  total: { amount: number; currency: string };
  placedAt: string;
  /** hand-off payload for the payment/tracking workstreams (steps 3–5) */
  handoff: { merchantDomain: string; paymentMethod?: string; deliveryPromise?: string };
};

const globalStore = globalThis as unknown as {
  __purchaseStates?: Map<string, string>;
  __orders?: Map<string, OrderRecord>;
};
const pausedStates: Map<string, string> = (globalStore.__purchaseStates ??= new Map());
const orders: Map<string, OrderRecord> = (globalStore.__orders ??= new Map());

const pendingProposals = new Map<string, CheckoutProposal>();

async function placeOrder(proposalId: string): Promise<OrderRecord> {
  const proposal = pendingProposals.get(proposalId);
  if (!proposal) throw new Error(`no pending proposal ${proposalId}`);
  const order: OrderRecord = {
    orderId: `ord-${randomUUID().slice(0, 8)}`,
    proposalId,
    merchant: proposal.merchantName,
    offerUrl: proposal.offerSnapshot.url,
    total: proposal.totalPrice,
    placedAt: new Date().toISOString(),
    handoff: {
      merchantDomain: proposal.merchantDomain,
      paymentMethod: proposal.paymentMethod,
      deliveryPromise: proposal.deliveryPromise,
    },
  };
  orders.set(order.orderId, order);
  try {
    const dir = path.join(process.cwd(), "data", "orders");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${order.orderId}.json`), JSON.stringify(order, null, 1));
  } catch {
    // persistence is best-effort
  }
  return order;
}

const finalizePurchase = tool({
  name: "finalize_purchase",
  description: "Places the order for a checkout proposal. Requires explicit human approval.",
  parameters: z.object({ proposalId: z.string() }),
  needsApproval: true,
  execute: async ({ proposalId }) => {
    const order = await placeOrder(proposalId);
    return `Order placed: ${order.orderId} at ${order.merchant}, total ${order.total.amount} ${order.total.currency}`;
  },
});

const purchaseAgent = new Agent({
  name: "purchase-gate",
  model: MODELS.fast,
  instructions:
    "You finalize a purchase by calling finalize_purchase with the given proposalId. " +
    "Call it exactly once. Never invent a different proposal.",
  tools: [finalizePurchase],
});

/** Run until the approval interruption; park the serialized state on the proposal id. */
export async function startPurchaseGate(proposal: CheckoutProposal): Promise<"paused" | "keyless"> {
  pendingProposals.set(proposal.id, proposal);
  if (!llmEnabled()) return "keyless";

  const result = await run(
    purchaseAgent,
    `Finalize the purchase for proposal ${proposal.id}: ${proposal.offerSnapshot.url} at ${proposal.merchantName}, total ${proposal.totalPrice.amount} ${proposal.totalPrice.currency}.`,
  );
  if (result.interruptions?.length) {
    pausedStates.set(proposal.id, JSON.stringify(result.state));
    return "paused";
  }
  // No interruption should be impossible with needsApproval; fail safe by NOT ordering.
  throw new Error("purchase agent did not pause for approval");
}

/** Resolve the parked interruption. Approve resumes the run (tool executes); reject cancels. */
export async function resolvePurchaseGate(proposal: CheckoutProposal, approve: boolean): Promise<OrderRecord | undefined> {
  pendingProposals.set(proposal.id, proposal);
  const serialized = pausedStates.get(proposal.id);

  if (!serialized) {
    // keyless path — identical consent semantics, no SDK run
    if (!approve) return undefined;
    return placeOrder(proposal.id);
  }

  const state = await RunState.fromString(purchaseAgent, serialized);
  const interruptions = state.getInterruptions();
  for (const interruption of interruptions) {
    if (approve) state.approve(interruption);
    else state.reject(interruption);
  }
  const result = await run(purchaseAgent, state);
  pausedStates.delete(proposal.id);

  if (!approve) return undefined;
  const order = [...orders.values()].find((o) => o.proposalId === proposal.id);
  if (!order) throw new Error(`approval resumed but no order was placed: ${JSON.stringify(result.finalOutput)}`);
  return order;
}

export function getOrder(orderId: string): OrderRecord | undefined {
  return orders.get(orderId);
}
