"use client";

import { useMemo, useState } from "react";
import type { ActiveTab, CallItem, SelectedChat } from "@/lib/types";
import { callItems } from "@/lib/data";
import { ChatsList } from "@/components/chats-list";
import { StatusList } from "@/components/status-list";
import { CallsList } from "@/components/calls-list";
import { SettingsDropdown } from "@/components/settings-dropdown";
import { SettingsContent } from "@/components/settings-content";
import { ChatView } from "@/components/chat-view";
import {
  CameraIcon,
  CallsIcon,
  ChatsIcon,
  CommunitiesIcon,
  MetaAiIcon,
  MoreIcon,
  PlusIcon,
  SearchIcon,
  UpdatesIcon,
  UserIcon,
} from "@/components/ios-icons";

const tabs: { id: ActiveTab; label: string; icon: typeof ChatsIcon }[] = [
  { id: "updates", label: "Updates", icon: UpdatesIcon },
  { id: "calls", label: "Calls", icon: CallsIcon },
  { id: "communities", label: "Communities", icon: CommunitiesIcon },
  { id: "chats", label: "Chats", icon: ChatsIcon },
  { id: "you", label: "You", icon: UserIcon },
];

const titles: Record<ActiveTab, string> = {
  updates: "Updates",
  calls: "Calls",
  communities: "Communities",
  chats: "Chats",
  you: "You",
};

export function WhatsAppApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("chats");
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const [showSettingsPage, setShowSettingsPage] = useState(false);
  const [selectedChat, setSelectedChat] = useState<SelectedChat | null>(null);
  const [calls, setCalls] = useState<CallItem[]>(callItems);
  const title = useMemo(() => titles[activeTab], [activeTab]);

  const closeSettings = () => {
    setSettingsClosing(true);
    window.setTimeout(() => {
      setSettingsOpen(false);
      setSettingsClosing(false);
    }, 300);
  };

  const selectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setQuery("");
    setShowSettingsPage(false);
    setSelectedChat(null);
    if (settingsOpen) closeSettings();
  };

  return (
    <main className="ios-app-shell">
      <div className="ios-app-surface">
        {selectedChat ? (
          <ChatView chat={selectedChat} onBack={() => setSelectedChat(null)} />
        ) : showSettingsPage ? (
          <SettingsContent onBack={() => setShowSettingsPage(false)} />
        ) : (
          <>
            <SettingsDropdown
              open={settingsOpen}
              closing={settingsClosing}
              activeTab={activeTab}
              onClose={closeSettings}
              onOpenSettings={() => {
                closeSettings();
                setShowSettingsPage(true);
              }}
              onClearCallLogs={() => {
                setCalls([]);
                closeSettings();
              }}
            />

            <header className="ios-header">
              <div className="ios-header-actions">
                <button
                  type="button"
                  className="ios-circle-button"
                  aria-label="More options"
                  onClick={() => setSettingsOpen(true)}
                >
                  <MoreIcon />
                </button>
                <div className="ios-header-actions-right">
                  <button type="button" className="ios-circle-button" aria-label="Open camera">
                    <CameraIcon />
                  </button>
                  <button type="button" className="ios-circle-button ios-circle-button-accent" aria-label="Start a new chat">
                    <PlusIcon />
                  </button>
                </div>
              </div>
              <h1>{title}</h1>
              {activeTab === "chats" ? (
                <label className="ios-search">
                  <SearchIcon />
                  <span className="sr-only">Search chats</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Ask Meta AI or Search"
                    type="search"
                  />
                </label>
              ) : null}
            </header>

            <div className="ios-content">
              {activeTab === "chats" ? (
                <ChatsList
                  query={query}
                  onSelectChat={(chat) => {
                    setSelectedChat({
                      friendName: chat.friendName,
                      friendStatus: chat.friendStatus,
                      imgName: chat.imgName,
                      imgFormat: chat.imgFormat,
                      imgSrc: chat.imgSrc,
                    });
                    if (settingsOpen) closeSettings();
                  }}
                />
              ) : null}
              {activeTab === "updates" ? <StatusList /> : null}
              {activeTab === "calls" ? <CallsList calls={calls} /> : null}
              {activeTab === "communities" ? (
                <EmptyTab icon={<CommunitiesIcon />} title="Communities" text="Your communities will appear here." />
              ) : null}
              {activeTab === "you" ? (
                <EmptyTab icon={<UserIcon />} title="You" text="Open settings to manage your profile and preferences." />
              ) : null}
            </div>

            {activeTab === "chats" ? (
              <button type="button" className="meta-ai-button" aria-label="Open Meta AI">
                <MetaAiIcon />
              </button>
            ) : null}

            <nav className="ios-tab-bar" aria-label="Main navigation">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    type="button"
                    key={tab.id}
                    className={active ? "active" : ""}
                    aria-current={active ? "page" : undefined}
                    onClick={() => selectTab(tab.id)}
                  >
                    <span className="ios-tab-icon"><Icon /></span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </>
        )}
      </div>
    </main>
  );
}

function EmptyTab({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <section className="ios-empty-tab">
      <div>{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}
