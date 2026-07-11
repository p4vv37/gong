"use client";

import Image from "next/image";
import Link from "next/link";
import type { SelectedChat } from "@/lib/types";
import { friendImagePath } from "@/lib/data";
import { BackIcon, PhoneIcon, VideoIcon } from "@/components/ios-icons";
import { useCallback, useRef, useState } from "react";
import { ChatBody, MessageInput } from "@/components/message-input";
import type { AgentRequestMessage, AgentResponse, ConversationMessage } from "@/lib/types";

type ChatViewProps = {
  chat: SelectedChat;
  showBackLink?: boolean;
  onBack?: () => void;
};

export function ChatView({ chat, showBackLink = false, onBack }: ChatViewProps) {
  const imageSrc = friendImagePath(chat.imgName, chat.imgFormat, chat.imgSrc);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [agentIsTyping, setAgentIsTyping] = useState(false);
  const messagesRef = useRef<ConversationMessage[]>([]);
  const pendingRequests = useRef(0);

  const appendMessage = useCallback((message: ConversationMessage) => {
    messagesRef.current = [...messagesRef.current, message];
    setMessages(messagesRef.current);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      type: "user",
      content,
      sentAt: new Date().toISOString(),
    };
    const requestMessages: AgentRequestMessage[] = [...messagesRef.current, userMessage].map((message) => ({
      role: message.type === "user" ? "user" : "assistant",
      content: message.content,
    }));

    appendMessage(userMessage);
    pendingRequests.current += 1;
    setAgentIsTyping(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: requestMessages }),
      });

      if (!response.ok) throw new Error("The agent request failed");

      const payload: AgentResponse = await response.json();
      appendMessage({ ...payload.message, id: crypto.randomUUID(), sentAt: new Date().toISOString() });
    } catch {
      appendMessage({
        id: crypto.randomUUID(),
        type: "agent",
        content: "Sorry, I couldn't get a response. Please try again.",
        sentAt: new Date().toISOString(),
      });
    } finally {
      pendingRequests.current -= 1;
      setAgentIsTyping(pendingRequests.current > 0);
    }
  }, [appendMessage]);

  return (
    <main className="ios-chat-view">
      <header className="ios-chat-header">
        <div className="ios-chat-contact">
          {onBack ? (
            <button type="button" className="ios-chat-back" onClick={onBack} aria-label="Back to chats">
              <BackIcon />
            </button>
          ) : showBackLink ? (
            <Link className="ios-chat-back" href="/" aria-label="Back to chats">
              <BackIcon />
            </Link>
          ) : null}
          <Image className="ios-chat-contact-avatar" src={imageSrc} alt="" width={56} height={56} />
          <div className="ios-chat-contact-copy">
            <h1>{chat.friendName}</h1>
            <p>{chat.friendStatus === "Online" ? "online" : "tap to add to contacts"}</p>
          </div>
        </div>
        <div className="ios-chat-actions">
          <button type="button" aria-label="Start video call"><VideoIcon /></button>
          <button type="button" aria-label="Start voice call"><PhoneIcon /></button>
        </div>
      </header>
      <ChatBody
        messages={messages}
        agentIsTyping={agentIsTyping}
        onArtifactButton={(buttonContent) => sendMessage(`user responded with: ${buttonContent}`)}
      />
      <MessageInput onSend={sendMessage} />
    </main>
  );
}
