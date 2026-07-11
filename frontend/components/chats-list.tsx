"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ChatPreview } from "@/lib/types";
import { chats, friendImagePath } from "@/lib/data";
import { CameraSmallIcon, CheckmarksIcon, MicSmallIcon } from "@/components/ios-icons";

export function ChatsList({ query = "" }: { query?: string }) {
  const router = useRouter();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleChats = normalizedQuery
    ? chats.filter((chat) =>
        `${chat.friendName} ${chat.lastMessage}`.toLocaleLowerCase().includes(normalizedQuery),
      )
    : chats;

  const openChat = (chat: ChatPreview) => {
    const params = new URLSearchParams({
      friendName: chat.friendName,
      friendStatus: chat.friendStatus,
      imgName: chat.imgName,
      imgFormat: chat.imgFormat,
      ...(chat.imgSrc ? { imgSrc: chat.imgSrc } : {}),
    });
    router.push(`/chat?${params.toString()}`);
  };

  if (visibleChats.length === 0) {
    return <p className="ios-no-results">No chats found</p>;
  }

  return (
    <section id="chats" aria-label="Chats">
      {visibleChats.map((chat) => (
        <button key={chat.id} type="button" className="ios-chat-row" onClick={() => openChat(chat)}>
          <Image
            className="ios-chat-avatar"
            src={friendImagePath(chat.imgName, chat.imgFormat, chat.imgSrc)}
            alt=""
            width={56}
            height={56}
          />
          <span className="ios-chat-copy">
            <span className="ios-chat-heading">
              <span className="ios-chat-name">{chat.friendName}</span>
              <span className={chat.unreadCount > 0 ? "ios-chat-time unread" : "ios-chat-time"}>{chat.time}</span>
            </span>
            <span className="ios-chat-preview-line">
              {chat.hasCheckmark ? <CheckmarksIcon color={chat.checkmarkColor} /> : null}
              {chat.hasMic ? <MicSmallIcon /> : null}
              {chat.hasPhoto ? <CameraSmallIcon /> : null}
              <span className={chat.isTyping || chat.isRecording ? "ios-chat-preview active" : "ios-chat-preview"}>
                {chat.lastMessage}
              </span>
              {chat.unreadCount > 0 ? <span className="ios-unread-badge">{chat.unreadCount}</span> : null}
            </span>
          </span>
        </button>
      ))}
    </section>
  );
}
