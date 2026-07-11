"use client";

import Image from "next/image";
import Link from "next/link";
import { useTheme } from "@/components/theme-provider";

type SettingsContentProps = {
  showBackLink?: boolean;
  onBack?: () => void;
};

export function SettingsContent({ showBackLink = false, onBack }: SettingsContentProps) {
  const { openThemeModal } = useTheme();

  return (
    <div id="body-content" className="relative min-h-screen bg-white dark:bg-WADarkGreen">
      <header className="sticky top-0 z-10 bg-WATeal dark:bg-WADarkTeal p-4 md:py-6 md:px-7 flex items-center">
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
        ) : onBack ? (
          <button type="button" className="flex-center mr-2 invert-[1]" onClick={onBack}>
            <Image
              className="w-5"
              src="https://img.icons8.com/android/96/null/left.png"
              alt="back icon"
              width={20}
              height={20}
              unoptimized
            />
          </button>
        ) : null}
        <div className="text-xl text-white font-medium px-12 py-1">Settings</div>
      </header>

      <section className="profile-tab">
        <div className="flex items-center justify-between py-5 px-6 transition duration-100 dark:bg-WADarkGreen hover:bg-gray-200 hover:dark:bg-WADarkTeal">
          <div className="flex">
            <div>
              <Image
                className="w-20 h-20 object-cover rounded-full"
                src="/imgs/my-profile-pic.jpg"
                alt="profile pic"
                width={80}
                height={80}
              />
            </div>
            <div className="flex flex-col p-3">
              <div className="text-black dark:text-white font-bold">Ayokanmi</div>
              <div className="mt-1 text-gray-900 dark:text-gray-400 font-normal text-xs">
                Only 🙏🏾 by His grace
              </div>
            </div>
          </div>
          <div className="flex">
            <Image className="w-8" src="/imgs/qr-code.png" alt="qr-code" width={32} height={32} />
          </div>
        </div>
      </section>

      <main className="md:hidden">
        <SettingsRow title="Account" subtitle="Security notifications, change number" />
        <SettingsRow title="Privacy" subtitle="Block contact, disappearing messages" isPrivacy />
        <button type="button" className="in-settings theme-setting w-full" onClick={openThemeModal}>
          <SettingsIcon type="chats" />
          <div className="flex flex-col text-left">
            <div className="text-black dark:text-white">Chats</div>
            <div className="text-gray-400 text-[10px]">Theme, wallpapers, chat history</div>
          </div>
        </button>
        <SettingsRow title="Notifications" subtitle="Message, group & call tones" isNotification />
        <SettingsRow title="Storage and data" subtitle="Network usage, auto-download" isStorage />
        <SettingsRow title="App language" subtitle="English (phone's language)" isLanguage />
        <SettingsRow title="Help" subtitle="Help centre, contact us, privacy policy" isHelp />
        <SettingsRow title="Invite friend" isInvite />
      </main>

      <main className="hidden md:block">
        <SettingsMdRow title="Notifications" isNotification />
        <SettingsMdRow title="Privacy" isPrivacy />
        <SettingsMdRow title="Security" isSecurity />
        <button type="button" className="in-settings-md theme-setting w-full" onClick={openThemeModal}>
          <SettingsIcon type="theme" />
          <div className="flex border-b grow border-b-gray-300 dark:border-b-gray-800 py-5">
            <div className="text-black dark:text-white text-base">Theme</div>
          </div>
        </button>
        <SettingsMdRow title="Chat Wallpaper" isWallpaper />
        <SettingsMdRow title="Media auto-download" isDownload />
        <SettingsMdRow title="Request Account Info" last />
      </main>
    </div>
  );
}

function SettingsRow({
  title,
  subtitle,
  isPrivacy,
  isNotification,
  isStorage,
  isLanguage,
  isHelp,
  isInvite,
}: {
  title: string;
  subtitle?: string;
  isPrivacy?: boolean;
  isNotification?: boolean;
  isStorage?: boolean;
  isLanguage?: boolean;
  isHelp?: boolean;
  isInvite?: boolean;
}) {
  return (
    <div className="in-settings">
      <SettingsIcon
        type={
          isPrivacy
            ? "privacy"
            : isNotification
              ? "notification"
              : isStorage
                ? "storage"
                : isLanguage
                  ? "language"
                  : isHelp
                    ? "help"
                    : isInvite
                      ? "invite"
                      : "account"
        }
      />
      <div className="flex flex-col">
        <div className="text-black dark:text-white">{title}</div>
        {subtitle ? <div className="text-gray-400 text-[10px]">{subtitle}</div> : null}
      </div>
    </div>
  );
}

function SettingsMdRow({
  title,
  isNotification,
  isPrivacy,
  isSecurity,
  isWallpaper,
  isDownload,
  last,
}: {
  title: string;
  isNotification?: boolean;
  isPrivacy?: boolean;
  isSecurity?: boolean;
  isWallpaper?: boolean;
  isDownload?: boolean;
  last?: boolean;
}) {
  return (
    <div className="in-settings-md">
      <SettingsIcon
        type={
          isNotification
            ? "notification"
            : isPrivacy
              ? "privacy"
              : isSecurity
                ? "security"
                : isWallpaper
                  ? "wallpaper"
                  : isDownload
                    ? "download"
                    : "accountInfo"
        }
        desktop
        last={last}
      />
      <div
        className={`flex border-b grow border-b-gray-300 dark:border-b-gray-800 ${last ? "pt-5 pb-8" : "py-5"}`}
      >
        <div className="text-black dark:text-white text-base">{title}</div>
      </div>
    </div>
  );
}

function SettingsIcon({
  type,
  desktop,
  last,
}: {
  type: string;
  desktop?: boolean;
  last?: boolean;
}) {
  const wrapperClass = desktop
    ? `grid place-items-center pl-3 pr-6 ${last ? "pt-5 pb-8" : "py-5"}`
    : "grid place-items-center pl-3 pr-6";

  return (
    <div className={wrapperClass}>
      {type === "account" ? (
        <svg className="w-6 h-6 rotate-[40deg] fill-gray-400" viewBox="0 0 24 24">
          <path d="M 14.414063 11.144531 C 14.957031 10.09375 15.273438 8.902344 15.273438 7.636719 C 15.273438 3.421875 11.851563 0 7.636719 0 C 3.421875 0 0 3.417969 0 7.636719 C 0 11.851563 3.421875 15.273438 7.636719 15.273438 C 8.902344 15.273438 10.09375 14.960938 11.140625 14.414063 L 15.273438 18.542969 L 17.453125 18.542969 C 17.453125 18.546875 17.453125 20.726563 17.453125 20.726563 L 19.636719 20.726563 L 19.636719 22.910156 L 20.726563 24 L 24 24 L 24 20.726563 Z M 5.5 8 C 4.121094 8 3 6.882813 3 5.5 C 3 4.117188 4.121094 3 5.5 3 C 6.882813 3 8 4.117188 8 5.5 C 8 6.882813 6.882813 8 5.5 8 Z" />
        </svg>
      ) : type === "privacy" ? (
        <svg viewBox="0 0 28 35" height="24" width="24">
          <path
            className="fill-gray-400"
            d="M14,1.10204082 C18.5689011,1.10204082 22.2727273,4.80586698 22.2727273,9.37476809 L22.272,12.1790408 L22.3564837,12.181606 C24.9401306,12.294858 27,14.4253101 27,17.0368705 L27,29.4665309 C27,32.1506346 24.824104,34.3265306 22.1400003,34.3265306 L5.85999974,34.3265306 C3.175896,34.3265306 1,32.1506346 1,29.4665309 L1,17.0368705 C1,14.3970988 3.10461313,12.2488858 5.72742704,12.178644 L5.72727273,9.37476809 C5.72727273,4.80586698 9.43109889,1.10204082 14,1.10204082 Z M14,19.5600907 C12.0418995,19.5600907 10.4545455,21.2128808 10.4545455,23.2517007 C10.4545455,25.2905206 12.0418995,26.9433107 14,26.9433107 C15.9581005,26.9433107 17.5454545,25.2905206 17.5454545,23.2517007 C17.5454545,21.2128808 15.9581005,19.5600907 14,19.5600907 Z M14,4.79365079 C11.4617216,4.79365079 9.39069048,6.79417418 9.27759175,9.30453585 L9.27272727,9.52092352 L9.272,12.1760408 L18.727,12.1760408 L18.7272727,9.52092352 C18.7272727,6.91012289 16.6108006,4.79365079 14,4.79365079 Z"
            fill="currentColor"
          />
        </svg>
      ) : type === "chats" ? (
        <svg viewBox="0 0 24 24" height="24" width="24">
          <path
            className="fill-gray-400"
            fill="currentColor"
            d="M19.005,3.175H4.674C3.642,3.175,3,3.789,3,4.821V21.02 l3.544-3.514h12.461c1.033,0,2.064-1.06,2.064-2.093V4.821C21.068,3.789,20.037,3.175,19.005,3.175z M14.016,13.044H7.041V11.1 h6.975V13.044z M17.016,9.044H7.041V7.1h9.975V9.044z"
          />
        </svg>
      ) : type === "notification" ? (
        <svg viewBox="0 0 24 24" height="24" width="24">
          <path
            className="fill-gray-400"
            fill="currentColor"
            d="M12,21.7c0.9,0,1.7-0.8,1.7-1.7h-3.4C10.3,20.9,11.1,21.7,12,21.7z M17.6,16.5v-4.7 c0-2.7-1.8-4.8-4.3-5.4V5.8c0-0.7-0.6-1.3-1.3-1.3s-1.3,0.6-1.3,1.3v0.6C8.2,7,6.4,9.1,6.4,11.8v4.7l-1.7,1.7v0.9h14.6v-0.9 L17.6,16.5z"
          />
        </svg>
      ) : type === "storage" ? (
        <svg className="w-6 h-6" viewBox="0 0 24 24">
          <path
            className="fill-gray-400"
            d="M11 2.05v3.02C7.608 5.557 5 8.475 5 12c0 3.866 3.134 7 7 7 1.572 0 3.024-.518 4.192-1.394l2.137 2.137C16.605 21.153 14.4 22 12 22 6.477 22 2 17.523 2 12c0-5.185 3.947-9.449 9-9.95zM21.95 13c-.2 2.011-.994 3.847-2.207 5.328l-2.137-2.136c.687-.916 1.153-2.006 1.323-3.192h3.022zM13.002 2.05c4.724.469 8.48 4.226 8.95 8.95h-3.022c-.438-3.065-2.863-5.49-5.928-5.929V2.049z"
          />
        </svg>
      ) : type === "security" ? (
        <svg viewBox="0 0 24 24" height="24" width="24">
          <path
            className="fill-gray-400"
            d="M12.027027,2 L4,5.56756757 L4,10.9189189 C4,15.8689189 7.42486486,20.4978378 12.027027,21.6216216 C16.6291892,20.4978378 20.0540541,15.8689189 20.0540541,10.9189189 L20.0540541,5.56756757 L12.027027,2 Z M12.027027,11.8018919 L18.2702703,11.8018919 C17.7975676,15.4764865 15.3448649,18.7497297 12.027027,19.7754054 L12.027027,11.8108108 L5.78378378,11.8108108 L5.78378378,6.72702703 L12.027027,3.95324324 L12.027027,11.8018919 Z"
            fill="currentColor"
            fillRule="nonzero"
          />
        </svg>
      ) : type === "theme" ? (
        <svg viewBox="0 0 24 24" height="24" width="24">
          <path
            className="fill-gray-400"
            d="M12,1 L15.219275,4.21927498 L19.780725,4.21927498 L19.780725,8.78072502 L23,12 L19.780725,15.219275 L19.780725,19.780725 L15.219275,19.780725 L12,23 L8.78072502,19.780725 L4.21927498,19.780725 L4.21927498,15.219275 L1,12 L4.21927498,8.78072502 L4.21927498,4.21927498 L8.78072502,4.21927498 L12,1 Z M12,6 L12,18 C15.31,18 18,15.31 18,12 C18,8.76522727 15.4308833,6.12259298 12.2246968,6.00414409 L12,6 Z"
            fill="currentColor"
            fillRule="nonzero"
          />
        </svg>
      ) : type === "wallpaper" ? (
        <svg viewBox="0 0 24 24" height="24" width="24">
          <path
            className="fill-gray-400"
            fill="currentColor"
            d="M4.9,5.9h6.4V4.1H4.9c-1,0-1.8,0.8-1.8,1.8v6.4h1.8V5.9z M10.2,13.9l-3.6,4.4h10.7 l-2.7-3.6l-1.8,2.4L10.2,13.9z M16.4,9.9c0-0.7-0.6-1.3-1.3-1.3s-1.3,0.6-1.3,1.3s0.6,1.3,1.3,1.3S16.4,10.6,16.4,9.9z M19.1,4.1 h-6.4v1.8h6.4v6.4h1.8V5.9C20.9,4.9,20.1,4.1,19.1,4.1z M19.1,20.1h-6.4v1.8h6.4c1,0,1.8-0.8,1.8-1.8v-6.4h-1.8V20.1z M4.9,13.7H3.1 v6.4c0,1,0.8,1.8,1.8,1.8h6.4v-1.8H4.9V13.7z"
          />
        </svg>
      ) : type === "download" ? (
        <svg viewBox="0 0 24 24" height="24" width="24">
          <path
            className="fill-gray-400"
            d="M19.4725963,12.2 L15.1725963,12.2 L15.1725963,2.9 C15.1725963,2.4 14.7725963,2 14.2725963,2 L9.97259631,2 C9.47259631,2 9.07259631,2.4 9.07259631,2.9 L9.07259631,12.2 L4.77259631,12.2 C3.97259631,12.2 3.77259631,12.7 4.27259631,13.3 L11.0725963,20.6 C11.7725963,21.5 12.4725963,21.3 13.1725963,20.6 L19.9725963,13.3 C20.4725963,12.7 20.2725963,12.2 19.4725963,12.2 Z"
            fill="currentColor"
          />
        </svg>
      ) : type === "accountInfo" ? (
        <svg viewBox="0 0 24 24" height="24" width="24" fill="none">
          <path
            className="fill-gray-400"
            fillRule="evenodd"
            clipRule="evenodd"
            d="M6 2C4.9 2 4.01 2.9 4.01 4L4 20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8.83C20 8.3 19.79 7.79 19.41 7.42L14.58 2.59C14.21 2.21 13.7 2 13.17 2H6ZM13 8V3.5L18.5 9H14C13.45 9 13 8.55 13 8ZM8 12C7.44772 12 7 12.4477 7 13C7 13.5523 7.44772 14 8 14H16C16.5523 14 17 13.5523 17 13C17 12.4477 16.5523 12 16 12H8ZM14 17C14 16.4477 13.5523 16 13 16H8C7.44772 16 7 16.4477 7 17C7 17.5523 7.44772 18 8 18H13C13.5523 18 14 17.5523 14 17Z"
            fill="currentColor"
          />
        </svg>
      ) : type === "invite" ? (
        <svg className="fill-gray-400" fill="#000000" width="24" height="24" viewBox="-3 0 32 32">
          <path d="M17.25 20.5c1.281 0.719 2 1.906 1.875 3.125-0.063 0.75-0.031 0.75-1 0.875-0.594 0.063-4.375 0.094-8.219 0.094-4.375 0-8.938-0.031-9.281-0.125-1.281-0.344-0.531-2.719 1.156-3.844 1.344-0.844 4.063-2.156 4.813-2.313 1.031-0.219 1.156-0.875 0-2.844-0.25-0.469-0.531-1.813-0.563-3.25-0.031-2.313 0.375-3.875 2.406-4.656 0.375-0.125 0.813-0.188 1.219-0.188 1.344 0 2.594 0.75 3.125 1.844 0.719 1.469 0.375 5.313-0.375 6.719-0.906 1.594-0.813 2.094 0.188 2.344 0.625 0.156 2.688 1.125 4.656 2.219zM24.094 18.531c1 0.531 1.563 1.5 1.469 2.438-0.031 0.563-0.031 0.594-0.781 0.688-0.375 0.063-2.344 0.094-4.656 0.094-0.406-0.969-1.188-1.844-2.25-2.406-1.219-0.688-2.656-1.406-3.75-1.875 0.719-0.344 1.344-0.625 1.625-0.688 0.781-0.188 0.875-0.625 0-2.188-0.219-0.375-0.469-1.438-0.5-2.563-0.031-1.813 0.375-3.063 1.938-3.656 0.313-0.094 0.656-0.156 0.969-0.156 1.031 0 2 0.563 2.406 1.438 0.531 1.156 0.281 4.156-0.281 5.281-0.688 1.25-0.625 1.625 0.156 1.813 0.5 0.125 2.094 0.906 3.656 1.781z" />
        </svg>
      ) : (
        <svg className="w-6 h-6" viewBox="0 0 31.925 31.925" fill="#9ca3af">
          <path d="M689.284,516.1a13.962,13.962,0,1,1-13.963,13.962A13.977,13.977,0,0,1,689.284,516.1m0-2a15.962,15.962,0,1,0,15.962,15.962A15.962,15.962,0,0,0,689.284,514.1Z" transform="translate(-673.321 -514.099)" />
        </svg>
      )}
    </div>
  );
}
