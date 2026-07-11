"use client";

import { useEffect, useRef, useState } from "react";
import type { ConversationMessage } from "@/lib/types";
import {
  AttachmentIcon,
  CameraChatIcon,
  CheckmarksIcon,
  MicrophoneIcon,
  SendIcon,
  StickerIcon,
} from "@/components/ios-icons";

function formatMessageTime(sentAt: string) {
  const date = new Date(sentAt);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function MessageInput({ onSend }: { onSend: (message: string) => void }) {
  const [message, setMessage] = useState("");
  const hasText = message.trim().length > 0;

  return (
    <form
      className="ios-message-composer"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmedMessage = message.trim();
        if (!trimmedMessage) return;
        onSend(trimmedMessage);
        setMessage("");
      }}
    >
      <button type="button" className="ios-composer-icon" aria-label="Add attachment"><AttachmentIcon /></button>
      <div className="ios-message-field">
        <input
          aria-label="Message"
          type="text"
          placeholder="Message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button type="button" aria-label="Open stickers"><StickerIcon /></button>
      </div>
      <button type="button" className="ios-composer-icon" aria-label="Open camera"><CameraChatIcon /></button>
      <button type="submit" className="ios-composer-icon" aria-label={hasText ? "Send message" : "Record voice message"}>
        {hasText ? <SendIcon /> : <MicrophoneIcon />}
      </button>
    </form>
  );
}

export function ChatBody({
  messages,
  agentIsTyping,
  onArtifactButton,
}: {
  messages: ConversationMessage[];
  agentIsTyping: boolean;
  onArtifactButton: (label: string) => void;
}) {
  const conversationEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, agentIsTyping]);

  return (
    <section className="ios-chat-canvas" aria-label="Conversation">
      <div className="ios-chat-date">Today</div>
      <div className="ios-encryption-notice">
        <span aria-hidden="true">🔒</span>
        Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them. <button type="button">Learn more</button>
      </div>
      {messages.map((message, index) => {
        const isUser = message.type === "user";
        const grouped = messages[index - 1]?.type === message.type;
        const rowSide = isUser ? "ios-message-row-user" : "ios-message-row-agent";
        const bubbleSide = isUser ? "ios-message-user" : "ios-message-agent";

        return (
          <div
            key={message.id}
            className={`ios-message-row ${rowSide}${grouped ? " ios-message-row-grouped" : ""}`}
          >
            <article className={`ios-message-bubble ${bubbleSide}${grouped ? " ios-message-grouped" : ""}`}>
              <p>{message.content}</p>
              {message.artifacts?.map((artifact, artifactIndex) =>
                artifact.type === "buttons" ? (
                  <div className="ios-message-buttons" key={`${message.id}-${artifactIndex}`}>
                    {artifact.buttons.map((label) => (
                      <button type="button" key={label} onClick={() => onArtifactButton(label)}>{label}</button>
                    ))}
                  </div>
                ) : null,
              )}
              <span className="ios-message-meta">
                <time dateTime={message.sentAt}>{formatMessageTime(message.sentAt)}</time>
                {isUser ? <CheckmarksIcon color="#53bdeb" /> : null}
              </span>
            </article>
          </div>
        );
      })}
      {agentIsTyping ? (
        <div className="ios-typing-indicator" aria-label="gong gang is typing" role="status">
          <span /> <span /> <span />
        </div>
      ) : null}
      <div ref={conversationEnd} />
    </section>
  );
}
