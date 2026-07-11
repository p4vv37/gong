"use client";

import { useEffect, useState, useTransition } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { createOrder, seedSampleOrders } from "@/app/orders/actions";
import { db } from "@/lib/firebase";
import {
  DEMO_USER_ID,
  type Order,
  type OrderHistoryEntry,
  type OrderState,
} from "@/lib/types";
import { OrderCard } from "./order-card";

type OrdersDashboardProps = {
  initialOrders: Order[];
};

function mapOrder(id: string, data: DocumentData): Order {
  return {
    id,
    userId: String(data.userId ?? ""),
    title: String(data.title ?? ""),
    state: data.state as OrderState,
    history: Array.isArray(data.history) ? (data.history as OrderHistoryEntry[]) : [],
    createdAt: String(data.createdAt ?? ""),
    updatedAt: String(data.updatedAt ?? ""),
  };
}

export function OrdersDashboard({ initialOrders }: OrdersDashboardProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [liveError, setLiveError] = useState("");
  const [isCreating, startCreating] = useTransition();
  const [isSeeding, startSeeding] = useTransition();

  // Subscribe to the demo user's orders so the dashboard reacts to database changes live.
  useEffect(() => {
    const ordersQuery = query(collection(db, "orders"), where("userId", "==", DEMO_USER_ID));
    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        setLiveError("");
        setOrders(
          snapshot.docs
            .map((docSnapshot) => mapOrder(docSnapshot.id, docSnapshot.data()))
            .sort((first, second) => second.createdAt.localeCompare(first.createdAt)),
        );
      },
      (subscriptionError) => {
        console.error("Order subscription failed", subscriptionError);
        setLiveError("Live updates are unavailable. Check your Firebase configuration and rules.");
      },
    );

    return unsubscribe;
  }, []);

  function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startCreating(async () => {
      const result = await createOrder(DEMO_USER_ID, title);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTitle("");
    });
  }

  function loadSampleData() {
    setError("");
    startSeeding(async () => {
      const result = await seedSampleOrders(DEMO_USER_ID);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <main className="h-full overflow-y-auto bg-slate-100 px-4 py-8 text-slate-900 dark:bg-WADarkestGreen dark:text-white sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-WATeal dark:text-WABrightGreen">
            Gong logistics
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Order tracking</h1>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Track each order from processing through last-mile delivery. Updates appear live as the
            database changes.
          </p>
        </header>

        <form onSubmit={submitOrder} className="rounded-2xl bg-white p-5 shadow-sm dark:bg-WADarkGreen">
          <label className="block text-sm font-semibold" htmlFor="order-title">
            Add an order
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              id="order-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Trail-running shoes"
              maxLength={200}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 dark:border-slate-600 dark:bg-WADarkTeal dark:text-white"
            />
            <button
              type="submit"
              disabled={isCreating || !title.trim()}
              className="rounded-lg bg-WABrightGreen px-4 py-2.5 font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? "Creating…" : "Create order"}
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        </form>

        {liveError ? (
          <p className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
            {liveError}
          </p>
        ) : null}

        <section aria-label="Orders" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">
              {orders.length} order{orders.length === 1 ? "" : "s"}
            </h2>
            <button
              type="button"
              onClick={loadSampleData}
              disabled={isSeeding}
              className="rounded-lg border border-WATeal px-3 py-1.5 text-sm font-semibold text-WATeal transition hover:bg-WATeal/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-WABrightGreen dark:text-WABrightGreen dark:hover:bg-WABrightGreen/10"
            >
              {isSeeding ? "Adding…" : "Add sample data"}
            </button>
          </div>
          {orders.length > 0 ? (
            <div className="grid gap-4">
              {orders.map((order) => <OrderCard key={order.id} order={order} />)}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600 dark:border-slate-600 dark:bg-WADarkGreen dark:text-slate-300">
              No orders yet. Create one above or add sample data.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
