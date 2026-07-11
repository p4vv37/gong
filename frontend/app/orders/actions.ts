"use server";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/firebase";
import {
  ORDER_STATES,
  type Order,
  type OrderActionResult,
  type OrderHistoryEntry,
  type OrderState,
} from "@/lib/types";

const MAX_USER_ID_LENGTH = 128;
const MAX_TITLE_LENGTH = 200;

function isOrderState(value: unknown): value is OrderState {
  return typeof value === "string" && ORDER_STATES.includes(value as OrderState);
}

function actionError(_error: unknown): OrderActionResult {
  return { ok: false, error: "Unable to save this order. Please try again." };
}

function orderFromData(id: string, data: Record<string, unknown>): Order {
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

function validUserId(userId: string): string | null {
  const value = userId.trim();
  if (!value) return null;
  return value.length <= MAX_USER_ID_LENGTH ? value : null;
}

export async function createOrder(userId: string, title: string): Promise<OrderActionResult> {
  const normalizedUserId = validUserId(userId);
  const normalizedTitle = title.trim();

  if (!normalizedUserId) {
    return { ok: false, error: "Enter a user ID (up to 128 characters)." };
  }

  if (!normalizedTitle || normalizedTitle.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: "Enter an order title (up to 200 characters)." };
  }

  const timestamp = new Date().toISOString();
  const firstState = ORDER_STATES[0];
  const history: OrderHistoryEntry[] = [{ state: firstState, at: timestamp }];

  try {
    const reference = await addDoc(collection(db, "orders"), {
      userId: normalizedUserId,
      title: normalizedTitle,
      state: firstState,
      history,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const order: Order = {
      id: reference.id,
      userId: normalizedUserId,
      title: normalizedTitle,
      state: firstState,
      history,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    revalidatePath("/orders");
    return { ok: true, order };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateOrderState(
  orderId: string,
  state: OrderState,
): Promise<OrderActionResult> {
  if (!orderId.trim()) {
    return { ok: false, error: "A valid order ID is required." };
  }

  if (!isOrderState(state)) {
    return { ok: false, error: "Choose a valid order state." };
  }

  try {
    const reference = doc(db, "orders", orderId);
    const snapshot = await getDoc(reference);

    if (!snapshot.exists()) {
      return { ok: false, error: "This order no longer exists." };
    }

    const existingOrder = orderFromData(snapshot.id, snapshot.data());
    const timestamp = new Date().toISOString();
    const history: OrderHistoryEntry[] = [...existingOrder.history, { state, at: timestamp }];

    await updateDoc(reference, { state, history, updatedAt: timestamp });
    revalidatePath("/orders");

    return {
      ok: true,
      order: { ...existingOrder, state, history, updatedAt: timestamp },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function getOrder(orderId: string): Promise<Order | null> {
  if (!orderId.trim()) return null;

  try {
    const snapshot = await getDoc(doc(db, "orders", orderId));
    return snapshot.exists() ? orderFromData(snapshot.id, snapshot.data()) : null;
  } catch {
    return null;
  }
}

export async function listOrders(userId: string): Promise<Order[]> {
  const normalizedUserId = validUserId(userId);
  if (!normalizedUserId) return [];

  try {
    const ordersQuery = query(
      collection(db, "orders"),
      where("userId", "==", normalizedUserId),
    );
    const snapshot = await getDocs(ordersQuery);

    return snapshot.docs
      .map((order) => orderFromData(order.id, order.data()))
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  } catch {
    return [];
  }
}
