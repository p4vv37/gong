"use client";

import { useState, useTransition } from "react";
import { updateOrderState } from "@/app/orders/actions";
import { OrderStateIcon } from "@/components/order-state-icons";
import { ORDER_STATES, type Order, type OrderState } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown";

  // Keep the SSR and browser output identical. Even with a pinned locale and
  // time zone, Intl output depends on the ICU/CLDR data version, which differs
  // between Node and browsers (e.g. en-GB "11 Jul 2026, 12:51" vs
  // "11 Jul 2026 at 12:51"), so build the string without Intl.
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function OrderCard({ order }: { order: Order }) {
  const [error, setError] = useState("");
  const [isUpdating, startUpdating] = useTransition();
  const currentIndex = ORDER_STATES.indexOf(order.state);
  const isFinalState = currentIndex === ORDER_STATES.length - 1;

  function changeState(state: OrderState) {
    setError("");
    startUpdating(async () => {
      const result = await updateOrderState(order.id, state);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm dark:bg-WADarkGreen">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Order</p>
          <h3 className="mt-1 text-lg font-bold">{order.title}</h3>
        </div>
        <span className="w-fit rounded-full bg-WATeal/10 px-3 py-1 text-sm font-semibold text-WATeal dark:bg-WABrightGreen/15 dark:text-WABrightGreen">
          {order.state}
        </span>
      </div>

      <div className="mt-6 overflow-x-auto pb-2">
        <ol className="flex min-w-[650px] items-start" aria-label="Order delivery pipeline">
          {ORDER_STATES.map((state, index) => {
            const complete = index < currentIndex;
            const current = index === currentIndex;

            return (
              <li key={state} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
                {index < ORDER_STATES.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={`absolute left-1/2 top-4 h-1 w-full ${index < currentIndex ? "bg-WABrightGreen" : "bg-slate-200 dark:bg-slate-600"}`}
                  />
                ) : null}
                <span
                  className={`relative z-10 grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                    complete
                      ? "bg-WABrightGreen text-slate-950"
                      : current
                        ? "border-4 border-WATeal bg-white text-WATeal dark:bg-WADarkGreen dark:text-WABrightGreen"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-200"
                  }`}
                >
                  {complete || current ? (
                    <OrderStateIcon state={state} animated={current} className="h-4.5 w-4.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className={`mt-2 max-w-28 text-xs leading-tight ${current ? "font-semibold" : "text-slate-600 dark:text-slate-300"}`}>
                  {state}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <dl className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
        <div><dt className="font-medium text-slate-900 dark:text-white">Order ID</dt><dd className="mt-0.5 break-all font-mono text-xs">{order.id}</dd></div>
        <div><dt className="font-medium text-slate-900 dark:text-white">Created</dt><dd className="mt-0.5">{formatTimestamp(order.createdAt)}</dd></div>
        <div><dt className="font-medium text-slate-900 dark:text-white">Last updated</dt><dd className="mt-0.5">{formatTimestamp(order.updatedAt)}</dd></div>
      </dl>

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-700 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={isUpdating || isFinalState}
          onClick={() => changeState(ORDER_STATES[currentIndex + 1])}
          className="rounded-lg bg-WATeal px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUpdating ? "Saving…" : isFinalState ? "Delivered" : "Advance"}
        </button>
        <label className="flex min-w-0 items-center gap-2 text-sm font-medium">
          Set stage
          <select
            value={order.state}
            disabled={isUpdating}
            onChange={(event) => changeState(event.target.value as OrderState)}
            className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-WADarkTeal dark:text-white"
          >
            {ORDER_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
        </label>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </article>
  );
}
