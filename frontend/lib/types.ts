export type ChatPreview = {
  id: string;
  friendName: string;
  friendStatus: string;
  imgName: string;
  imgFormat: string;
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

export type ActiveTab = "chats" | "status" | "calls";

export type SelectedChat = {
  friendName: string;
  friendStatus: string;
  imgName: string;
  imgFormat: string;
};

export type ThemeValue = "default" | "light" | "dark";
