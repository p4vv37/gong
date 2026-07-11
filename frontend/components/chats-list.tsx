"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ChatPreview } from "@/lib/types";
import { chats, friendImagePath } from "@/lib/data";

type ChatsListProps = {
  onSelectChat: (chat: ChatPreview) => void;
};

function Checkmark({ color }: { color: string }) {
  return (
    <svg className="flex items-center justify-center" height="17" width="17">
      <use xlinkHref="#double-checkmark" fill={color} />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="flex items-center justify-center" height="16" width="16">
      <use xlinkHref="#mic" fill="#25d466" />
    </svg>
  );
}

export function ChatsList({ onSelectChat }: ChatsListProps) {
  const router = useRouter();

  const handleClick = (chat: ChatPreview) => {
    if (window.innerWidth < 768) {
      const params = new URLSearchParams({
        friendName: chat.friendName,
        friendStatus: chat.friendStatus,
        imgName: chat.imgName,
        imgFormat: chat.imgFormat,
      });
      router.push(`/chat?${params.toString()}`);
      return;
    }
    onSelectChat(chat);
  };

  return (
    <section id="chats">
      {chats.map((chat) => {
        const imageSrc = friendImagePath(chat.imgName, chat.imgFormat);
        const timeClass =
          chat.isTyping || chat.isRecording || chat.unreadCount > 0
            ? "text-WABrightGreen dark:text-WADarkGreen2"
            : "text-gray-900 dark:text-gray-400";
        const messageClass = chat.isTyping || chat.isRecording
          ? "text-WABrightGreen"
          : "dark:text-gray-400 text-gray-900";

        return (
          <div
            key={chat.id}
            className="chats"
            onClick={() => handleClick(chat)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                handleClick(chat);
              }
            }}
          >
            <div className="flex">
              <div>
                <Image
                  className="w-14 h-14 object-cover rounded-full"
                  src={imageSrc}
                  alt="friend"
                  width={56}
                  height={56}
                />
              </div>
              <div className="flex flex-col gap-y-1 p-3">
                <div className="dark:text-white text-sm font-bold text-black truncate long-text">
                  {chat.friendName}
                </div>
                <div className="flex items-center gap-x-0.5">
                  {chat.hasCheckmark ? (
                    <div className="flex items-center justify-center pt-0.5">
                      <Checkmark color={chat.checkmarkColor ?? "#8696A0"} />
                    </div>
                  ) : null}
                  {chat.hasMic ? (
                    <div className="flex items-center justify-center">
                      <MicIcon />
                    </div>
                  ) : null}
                  {chat.hasPhoto ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 2.5 2.06"
                    >
                      <path
                        fill="#85959F"
                        d="M0.66 1.21l0.46 0.4 0.49 -0.61 0.61 0.77 -1.9 0 0.34 -0.55zm-0.66 0.85l2.5 0 0 -2.06 -2.5 0 0 2.06z"
                      />
                    </svg>
                  ) : null}
                  <div
                    className={`items-center text-xs font-normal truncate leading-none ${messageClass} ${chat.messageClassName ?? ""}`}
                  >
                    {chat.lastMessage}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1 justify-center my-1 text-[8px]">
              <div className={`${timeClass} grid place-items-center whitespace-nowrap`}>
                {chat.time}
              </div>
              <div
                className={`mt-1 mx-auto w-6 py-3 text-center text-white bg-WABrightGreen dark:bg-WADarkGreen2 dark:text-WADarkGreen leading-[0] rounded-full ${
                  chat.unreadCount === 0 ? "invisible" : ""
                }`}
              >
                {chat.unreadCount || 1}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
