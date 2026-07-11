import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import type { PurchaseBrief, DecisionQuestion } from "@/domain/purchase-brief";
import type { ResearchMode } from "@/contract/research";
import { ensureFirebaseUser, getFirebaseClient } from "./client";

export type ChatPhase = "intake" | "questions" | "ready" | "researching" | "results" | "error";

export type SyncedPurchaseChat = {
  version: 1;
  revision: number;
  request: string;
  depth: number;
  phase: ChatPhase;
  brief: PurchaseBrief | null;
  questions: DecisionQuestion[];
  provider: "mock" | "openai";
  researchMode: ResearchMode;
  runId: string | null;
  progressLabels: string[];
  error: string | null;
};

export type SyncStatus = "connecting" | "live" | "saving" | "local" | "error";

export function createEmptyChat(): SyncedPurchaseChat {
  return {
    version: 1,
    revision: Date.now(),
    request: "",
    depth: 40,
    phase: "intake",
    brief: null,
    questions: [],
    provider: "mock",
    researchMode: "fixture",
    runId: null,
    progressLabels: [],
    error: null,
  };
}

function serializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function savePurchaseChat(chatId: string, state: SyncedPurchaseChat) {
  const firebase = getFirebaseClient();
  const user = await ensureFirebaseUser();
  if (!firebase || !user) return false;

  await setDoc(
    doc(firebase.db, "purchaseChats", chatId),
    {
      ownerUid: user.uid,
      state: serializable(state),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return true;
}

export async function subscribeToPurchaseChat(
  chatId: string,
  onState: (state: SyncedPurchaseChat | null) => void,
  onStatus: (status: SyncStatus) => void,
): Promise<Unsubscribe> {
  const firebase = getFirebaseClient();
  if (!firebase) {
    onStatus("local");
    return () => undefined;
  }

  onStatus("connecting");
  try {
    const user = await ensureFirebaseUser();
    if (!user) {
      onStatus("local");
      return () => undefined;
    }

    return onSnapshot(
      doc(firebase.db, "purchaseChats", chatId),
      { includeMetadataChanges: true },
      (snapshot) => {
        onStatus(snapshot.metadata.hasPendingWrites ? "saving" : "live");
        if (!snapshot.exists()) {
          onState(null);
          return;
        }
        const value = snapshot.data().state as SyncedPurchaseChat | undefined;
        if (value?.version === 1) onState(value);
      },
      () => onStatus("error"),
    );
  } catch {
    onStatus("error");
    return () => undefined;
  }
}
