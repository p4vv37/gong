"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { ActiveTab } from "@/lib/types";

const baseOptions = [
  "New Group",
  "New Broadcast",
  "Linked Device",
  "Starred Messages",
];

type SettingsDropdownProps = {
  open: boolean;
  closing: boolean;
  activeTab: ActiveTab;
  onClose: () => void;
  onOpenSettings: () => void;
  onClearCallLogs: () => void;
};

export function SettingsDropdown({
  open,
  closing,
  activeTab,
  onClose,
  onOpenSettings,
  onClearCallLogs,
}: SettingsDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleBlur = () => onClose();
    const node = ref.current;
    node?.addEventListener("blur", handleBlur);
    node?.focus({ preventScroll: true });

    return () => node?.removeEventListener("blur", handleBlur);
  }, [open, onClose]);

  if (!open) {
    return (
      <div className="relative md:fixed w-full md:w-2/5 z-10">
        <div
          id="settings"
          className="fixed md:absolute top-0 right-0 dark:bg-WADarkGreen dark:text-white focus:outline-none hidden w-3/5 text-black bg-white shadow-md"
          tabIndex={-1}
        />
      </div>
    );
  }

  const tabClass =
    activeTab === "updates"
      ? "status-active"
      : activeTab === "calls"
        ? "call-active"
        : "";

  return (
    <div className="relative z-50">
      <div
        ref={ref}
        id="settings"
        tabIndex={-1}
        className={`fixed top-[calc(env(safe-area-inset-top)+3.5rem)] right-4 max-w-[18rem] w-[72%] rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 dark:bg-[#202020] dark:text-white focus:outline-none text-black bg-white shadow-2xl ${tabClass} ${
          closing ? "animate-fade-out" : "animate-slide-in-down"
        }`}
      >
        <ul>
          {baseOptions.map((option) => (
            <li key={option} className="options">
              {option}
            </li>
          ))}
          <li className="options status-option">Status privacy</li>
          <li
            className="options call-option"
            onClick={onClearCallLogs}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onClearCallLogs();
              }
            }}
          >
            Clear logs
          </li>
          <Link className="options-setting block md:hidden" href="/settings">
            Settings
          </Link>
          <li
            className="options-setting hidden md:block"
            onClick={onOpenSettings}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onOpenSettings();
              }
            }}
          >
            Settings
          </li>
        </ul>
      </div>
    </div>
  );
}
