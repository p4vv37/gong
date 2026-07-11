"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import type { ActiveTab, CallItem, ChatPreview, SelectedChat } from "@/lib/types";
import { callItems } from "@/lib/data";
import { ChatsList } from "@/components/chats-list";
import { StatusList } from "@/components/status-list";
import { CallsList } from "@/components/calls-list";
import { SearchDropdown } from "@/components/search-dropdown";
import { SettingsDropdown } from "@/components/settings-dropdown";
import { SettingsContent } from "@/components/settings-content";
import { ChatView } from "@/components/chat-view";
import { DefaultPanel } from "@/components/default-panel";

const tabs: { id: ActiveTab; label: string; badge?: string; dot?: boolean }[] = [
  { id: "chats", label: "Chats", badge: "11" },
  { id: "status", label: "Status", dot: true },
  { id: "calls", label: "Calls" },
];

export function WhatsAppApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("chats");
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const [showSettingsPage, setShowSettingsPage] = useState(false);
  const [selectedChat, setSelectedChat] = useState<SelectedChat | null>(null);
  const [hideStatusDot, setHideStatusDot] = useState(false);
  const [calls, setCalls] = useState<CallItem[]>(callItems);
  const swiperRef = useRef<SwiperType | null>(null);
  const columnRef = useRef<HTMLDivElement>(null);

  const closeSettings = () => {
    setSettingsClosing(true);
    setTimeout(() => {
      setSettingsOpen(false);
      setSettingsClosing(false);
    }, 500);
  };

  const handleTabChange = (index: number) => {
    const tab = tabs[index];
    setActiveTab(tab.id);
    if (tab.id === "status") {
      setHideStatusDot(true);
    }
  };

  const handleSelectChat = (chat: ChatPreview) => {
    setSelectedChat({
      friendName: chat.friendName,
      friendStatus: chat.friendStatus,
      imgName: chat.imgName,
      imgFormat: chat.imgFormat,
    });
  };

  const handleClearCallLogs = () => {
    setCalls([]);
    closeSettings();
  };

  useEffect(() => {
    const column = columnRef.current;
    if (!column) {
      return;
    }

    const handleScroll = () => {
      setSearchOpen(false);
      if (settingsOpen) {
        closeSettings();
      }
    };

    column.addEventListener("scroll", handleScroll);
    return () => column.removeEventListener("scroll", handleScroll);
  }, [settingsOpen]);

  return (
    <div className="md:flex md:flex-row font-roboto w-full">
      <div
        ref={columnRef}
        id="column-1"
        className="relative dark:bg-WADarkGreen w-full md:w-[45%] xl:w-2/5 h-screen overflow-y-auto"
      >
        {showSettingsPage ? (
          <SettingsContent onBack={() => setShowSettingsPage(false)} />
        ) : (
          <>
            <SearchDropdown
              open={searchOpen}
              showFilters={activeTab === "chats"}
              onClose={() => setSearchOpen(false)}
            />

            <SettingsDropdown
              open={settingsOpen}
              closing={settingsClosing}
              activeTab={activeTab}
              onClose={closeSettings}
              onOpenSettings={() => {
                closeSettings();
                setShowSettingsPage(true);
              }}
              onClearCallLogs={handleClearCallLogs}
            />

            <div className="relative flex flex-row items-center pt-6 px-6 w-full md:sticky md:top-0 z-[5] bg-WATeal dark:bg-WADarkTeal text-white dark:text-gray-400">
              <div className="justify-self-start text-2xl font-bold">WhatsApp</div>
              <div className="flex gap-4 ml-auto">
                <Image
                  className="dual w-6"
                  src="https://img.icons8.com/fluency-systems-regular/100/null/camera.png"
                  alt="camera"
                  width={24}
                  height={24}
                  unoptimized
                />
                <button type="button" onClick={() => setSearchOpen(true)}>
                  <Image
                    className="dual w-6"
                    src="https://img.icons8.com/ios-glyphs/100/000000/search--v1.png"
                    alt="search"
                    width={24}
                    height={24}
                    unoptimized
                  />
                </button>
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

            <div className="flex flex-row items-center justify-between pt-4 px-6 w-full z-[5] sticky top-0 md:top-[55px] bg-WATeal dark:bg-WADarkTeal dark:text-gray-400 shadow-md">
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`nav-items space-x-1 ${activeTab === tab.id ? "active" : ""}`}
                  onClick={() => {
                    swiperRef.current?.slideTo(index);
                    setActiveTab(tab.id);
                    if (tab.id === "status") {
                      setHideStatusDot(true);
                    }
                  }}
                >
                  <div className="text-gray-100 hover:text-white dark:hover:text-WATeal transition-colors duration-300">
                    {tab.label}
                  </div>
                  {tab.badge ? (
                    <div className="bg-white dark:bg-WATeal text-WATeal dark:text-WADarkTeal text-[0.5rem] w-5 h-5 leading-[0] flex-center text-center rounded-full">
                      {tab.badge}
                    </div>
                  ) : null}
                  {tab.dot ? (
                    <div
                      id="status-update-notification"
                      className={`bg-gray-100 hover:bg-white w-1.5 h-1.5 leading-[0] rounded-full ${
                        hideStatusDot ? "hidden" : ""
                      }`}
                    />
                  ) : null}
                </button>
              ))}
            </div>

            <div id="slides-container" className="bg-white dark:bg-WADarkGreen">
              <Swiper
                autoHeight
                onSwiper={(swiper) => {
                  swiperRef.current = swiper;
                }}
                onSlideChange={(swiper) => handleTabChange(swiper.activeIndex)}
              >
                <SwiperSlide>
                  <ChatsList onSelectChat={handleSelectChat} />
                </SwiperSlide>
                <SwiperSlide>
                  <StatusList />
                </SwiperSlide>
                <SwiperSlide>
                  <CallsList calls={calls} />
                </SwiperSlide>
              </Swiper>
            </div>

            <FloatingActions activeTab={activeTab} />
          </>
        )}
      </div>

      <div
        id="column-2"
        className="hidden md:block md:w-[65%] xl:w-3/5 h-screen overflow-y-auto"
        onClick={() => {
          if (settingsOpen) {
            closeSettings();
          }
        }}
      >
        {selectedChat ? <ChatView chat={selectedChat} /> : <DefaultPanel />}
      </div>
    </div>
  );
}

function FloatingActions({ activeTab }: { activeTab: ActiveTab }) {
  return (
    <>
      <div className="fixed right-5 bottom-5 md:right-[61.5%] xl:right-[63%] z-[999] w-14 h-14 rounded-full bg-WABrightGreen flex items-center justify-center shadow-md">
        {activeTab === "chats" ? (
          <div id="chats-message-icon" className="flex justify-center items-center">
            <svg viewBox="0 0 24 24" height="24" width="24">
              <path
                fill="#ffffff"
                d="M19.005,3.175H4.674C3.642,3.175,3,3.789,3,4.821V21.02 l3.544-3.514h12.461c1.033,0,2.064-1.06,2.064-2.093V4.821C21.068,3.789,20.037,3.175,19.005,3.175z M14.016,13.044H7.041V11.1 h6.975V13.044z M17.016,9.044H7.041V7.1h9.975V9.044z"
              />
            </svg>
          </div>
        ) : null}
        {activeTab === "status" ? (
          <div
            id="status-camera-icon"
            className="relative top-[0.25%] flex justify-center items-center"
          >
            <svg
              version="1.0"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 96 96"
              preserveAspectRatio="xMidYMid meet"
            >
              <g transform="translate(0,96) scale(0.1,-0.1)" fill="#ffffff" stroke="none">
                <path d="M315 840 c-39 -40 -39 -40 -117 -40 -124 0 -118 16 -118 -320 0 -267 1 -281 20 -300 19 -19 33 -20 380 -20 347 0 361 1 380 20 19 19 20 33 20 300 0 336 6 320 -118 320 -78 0 -78 0 -117 40 l-39 40 -126 0 -126 0 -39 -40z m253 -189 c67 -34 102 -93 102 -171 0 -111 -79 -190 -190 -190 -111 0 -190 79 -190 190 0 111 77 189 188 190 33 0 67 -7 90 -19z" />
                <path d="M394 566 c-30 -30 -34 -40 -34 -86 0 -46 4 -56 34 -86 30 -30 40 -34 86 -34 46 0 56 4 86 34 30 30 34 40 34 86 0 46 -4 56 -34 86 -30 30 -40 34 -86 34 -46 0 -56 -4 -86 -34z" />
              </g>
            </svg>
          </div>
        ) : null}
        {activeTab === "calls" ? (
          <div
            id="calls-add-call-icon"
            className="relative top-[0.0625rem] right-[0.0625rem] flex justify-center items-center"
          >
            <svg
              version="1.0"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 96 96"
              preserveAspectRatio="xMidYMid meet"
            >
              <g transform="translate(0,96) scale(0.1,-0.1)" fill="#ffffff" stroke="none">
                <path d="M140 820 c-58 -58 15 -316 130 -455 117 -141 320 -245 477 -245 77 0 93 19 93 111 0 39 -4 79 -10 89 -13 25 -61 39 -142 42 l-67 3 -48 -47 -48 -46 -50 33 c-58 38 -142 123 -178 180 l-25 40 46 48 47 48 -3 67 c-3 81 -17 129 -42 142 -10 6 -50 10 -89 10 -58 0 -75 -4 -91 -20z" />
                <path d="M647 834 c-4 -4 -7 -31 -7 -60 l0 -53 -57 -3 -58 -3 0 -35 0 -35 57 -3 57 -3 3 -57 3 -57 35 0 35 0 3 57 3 57 57 3 57 3 0 35 0 35 -57 3 -57 3 -3 57 c-3 55 -4 57 -33 60 -17 2 -34 0 -38 -4z" />
              </g>
            </svg>
          </div>
        ) : null}
      </div>

      {activeTab === "status" ? (
        <div
          id="status-pen-icon"
          className="fixed right-[1.625rem] bottom-[1.625rem] z-10 w-11 h-11 rounded-full flex justify-center items-center bg-blue-100 dark:bg-gray-600 transition-transform duration-500 ease-out shadow-md -translate-y-20"
        >
          <Image
            width={24}
            height={24}
            className="dark:hidden"
            src="https://img.icons8.com/external-others-inmotus-design/100/000000/external-Pen-result-others-inmotus-design-5.png"
            alt="pen light"
            unoptimized
          />
          <Image
            width={24}
            height={24}
            className="hidden dark:block"
            src="https://i.postimg.cc/Xp15YWgQ/icons8-pen-100-whatsapp-darkmode-status-pen-icon-white.png"
            alt="pen dark"
            unoptimized
          />
        </div>
      ) : null}
    </>
  );
}
