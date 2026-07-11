"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
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
  const [liveError, setLiveError] = useState("");

  // Subscribe to the user's orders so the dashboard reacts to database changes live.
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
      () => {
        setLiveError("Live updates are unavailable. Check your Firebase configuration and rules.");
      },
    );

    return unsubscribe;
  }, []);

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

        {liveError ? (
          <p className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
            {liveError}
          </p>
        ) : null}

        <section aria-label="Orders" className="space-y-4">
          <h2 className="text-lg font-bold">
            {orders.length} order{orders.length === 1 ? "" : "s"}
          </h2>
          {orders.length > 0 ? (
            <div className="grid gap-4">
              {orders.map((order) => <OrderCard key={order.id} order={order} />)}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600 dark:border-slate-600 dark:bg-WADarkGreen dark:text-slate-300">
              No orders yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
