export type ChatPreview = {
  id: string;
  friendName: string;
  friendStatus: string;
  imgName: string;
  imgFormat: string;
  imgSrc?: string;
  lastMessage: string;
  time: string;
  unreadCount: number;
  isTyping?: boolean;
  isRecording?: boolean;
  checkmarkColor?: string;
  hasCheckmark?: boolean;
  hasMic?: boolean;
  hasPhoto?: boolean;
  messageClassName?: string;
};

export type StatusItem = {
  id: string;
  name: string;
  time: string;
  timeDesktop?: string;
  img: string;
  ringClass: string;
  showMenu?: boolean;
};

export type CallItem = {
  id: string;
  name: string;
  img: string;
  direction: "incoming" | "outgoing";
  time: string;
  missed?: boolean;
};

export type ActiveTab = "updates" | "calls" | "communities" | "chats" | "you";

export type SelectedChat = {
  friendName: string;
  friendStatus: string;
  imgName: string;
  imgFormat: string;
  imgSrc?: string;
};

export type MessageButtonVariant = "green" | "destructive";

export type MessageArtifactButton = {
  id: string;
  content: string;
  variant?: MessageButtonVariant;
};

export type MessageArtifact = {
  type: "buttons";
  buttons: MessageArtifactButton[];
};

export type ConversationMessage = {
  id: string;
  type: "user" | "agent";
  content: string;
  sentAt: string;
  artifacts?: MessageArtifact[];
};

export type AgentRequestMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentResponse = {
  message: Omit<ConversationMessage, "id" | "sentAt">;
};

export type ThemeValue = "default" | "light" | "dark";

// Every order is associated with this fixed user until auth is added.
export const DEMO_USER_ID = "demo";

export const ORDER_STATES = [
  "Order Processing",
  "Order Fulfillment & Preparation",
  "Transit and Linehaul",
  "Destination & Import Processing",
  "Last-Mile Delivery",
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

export type OrderHistoryEntry = {
  state: OrderState;
  at: string;
};

export type Order = {
  id: string;
  userId: string;
  title: string;
  state: OrderState;
  history: OrderHistoryEntry[];
  createdAt: string;
  updatedAt: string;
};

export type OrderActionResult =
  | { ok: true; order: Order }
  | { ok: false; error: string };
