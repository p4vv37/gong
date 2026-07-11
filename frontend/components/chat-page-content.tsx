"use client";

import { useSearchParams } from "next/navigation";
import { ChatView } from "@/components/chat-view";
import { SvgSymbols } from "@/components/svg-symbols";

export function ChatPageContent() {
  const searchParams = useSearchParams();
  const friendName = searchParams.get("friendName");
  const friendStatus = searchParams.get("friendStatus");
  const imgName = searchParams.get("imgName");
  const imgFormat = searchParams.get("imgFormat");
  const imgSrc = searchParams.get("imgSrc") ?? undefined;

  if (!friendName || !friendStatus || !imgName || !imgFormat) {
    return (
      <div className="font-roboto min-h-screen flex items-center justify-center dark:bg-WADarkGreen">
        <p className="text-gray-600 dark:text-gray-300">Chat not found.</p>
      </div>
    );
  }

  return (
    <>
      <ChatView
        showBackLink
        chat={{
          friendName,
          friendStatus,
          imgName,
          imgFormat,
          imgSrc,
        }}
      />
      <SvgSymbols />
    </>
  );
}
