import type { Metadata } from "next";
import { WhatsAppPurchaseChat } from "@/components/whatsapp-purchase-chat";
import "./whatsapp.css";

export const metadata: Metadata = {
  title: "gong chat · realtime purchasing agent",
  description: "A realtime, conversation-first purchasing agent interface.",
};

export default function WhatsAppPage() {
  return <WhatsAppPurchaseChat />;
}
