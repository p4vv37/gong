"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { SelectedChat } from "@/lib/types";
import { friendImagePath } from "@/lib/data";
import { ChatBody, MessageInput } from "@/components/message-input";

const chatOptions = [
  "View contact",
  "Media, links and docs",
  "Search",
  "Mute notification",
  "Disappearing messages",
  "Wallpaper",
  "More",
];

type ChatViewProps = {
  chat: SelectedChat;
  showBackLink?: boolean;
};

export function ChatView({ chat, showBackLink = false }: ChatViewProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const imageSrc = friendImagePath(chat.imgName, chat.imgFormat);

  const closeSettings = () => {
    setSettingsClosing(true);
    setTimeout(() => {
      setSettingsOpen(false);
      setSettingsClosing(false);
    }, 500);
  };

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    const handleBlur = () => closeSettings();
    const node = settingsRef.current;
    node?.addEventListener("blur", handleBlur);
    node?.focus({ preventScroll: true });

    return () => node?.removeEventListener("blur", handleBlur);
  }, [settingsOpen]);

  return (
    <div className="relative font-roboto w-full h-full">
      <div className="relative w-full">
        <div
          ref={settingsRef}
          id="chat-settings"
          tabIndex={-1}
          className={`fixed top-0 right-0 md:absolute md:w-2/5 dark:bg-WADarkGreen dark:text-white focus:outline-none z-20 w-3/5 text-black bg-white shadow-md ${
            settingsOpen
              ? settingsClosing
                ? "animate-fade-out"
                : "animate-slide-in-down"
              : "hidden"
          }`}
        >
          <ul>
            {chatOptions.map((option) => (
              <li key={option} className="options">
                {option}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <header className="sticky top-0 z-10 bg-WATeal dark:bg-WADarkTeal dark:text-gray-400 flex flex-col w-full p-3 text-white">
        <div className="flex flex-row items-center">
          <div className="flex">
            {showBackLink ? (
              <Link href="/" className="flex-center mr-2 invert-[1]">
                <Image
                  className="w-5"
                  src="https://img.icons8.com/android/96/null/left.png"
                  alt="back icon"
                  width={20}
                  height={20}
                  unoptimized
                />
              </Link>
            ) : null}
            <div className="flex-center">
              <Image
                className="w-9 h-9 object-cover rounded-full"
                src={imageSrc}
                alt="friend"
                width={36}
                height={36}
              />
            </div>
            <div className="flex flex-col px-3 py-1">
              <div className="text-sm font-bold text-white">{chat.friendName}</div>
              <div className="text-xs font-normal text-white">{chat.friendStatus}</div>
            </div>
          </div>
          <div className="flex gap-4 ml-auto">
            <Image
              className="dual w-6"
              src="https://img.icons8.com/android/96/null/video-call.png"
              alt="video call"
              width={24}
              height={24}
              unoptimized
            />
            <Image
              className="dual w-6"
              src="https://img.icons8.com/material-sharp/96/000000/phone.png"
              alt="phone"
              width={24}
              height={24}
              unoptimized
            />
            <button type="button" onClick={() => setSettingsOpen(true)}>
              <Image
                className="dual w-6"
                src="https://img.icons8.com/external-glyph-silhouettes-icons-papa-vector/100/null/external-Menu-interface-glyph-silhouettes-icons-papa-vector-3.png"
                alt="kebab"
                width={24}
                height={24}
                unoptimized
              />
            </button>
          </div>
        </div>
      </header>

      <ChatBody />
      <MessageInput />
    </div>
  );
}
