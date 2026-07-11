import { Suspense } from "react";
import { ChatPageContent } from "@/components/chat-page-content";

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="font-roboto min-h-screen flex items-center justify-center dark:bg-WADarkGreen">
          <p className="text-gray-600 dark:text-gray-300">Loading chat...</p>
        </div>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}
