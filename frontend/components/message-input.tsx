"use client";

import { useState } from "react";
import Image from "next/image";

type MessageInputProps = {
  className?: string;
};

export function MessageInput({ className = "" }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const hasText = message.length > 0;

  return (
    <section
      className={`fixed bottom-2 right-0 left-0 w-[98%] mx-auto flex gap-1 z-10 md:bottom-2 md:w-[55%] md:right-[2%] md:left-auto ${className}`}
    >
      <div className="rounded-full flex py-3 px-2 xs:grow-0 xs:w-10/12 grow bg-white dark:bg-WADarkTeal drop-shadow overflow-x-hidden">
        <svg
          className="w-6 h-6 mx-3"
          version="1.0"
          xmlns="http://www.w3.org/2000/svg"
          width="458"
          height="457"
          viewBox="0 0 458 457"
          preserveAspectRatio="xMidYMid meet"
        >
          <g
            className="fill-gray-400"
            transform="translate(0,457) scale(0.1,-0.1)"
            fill="#000000"
            stroke="none"
          >
            <path d="M2065 4564 c-490 -51 -893 -217 -1245 -512 -666 -557 -964 -1500 -751 -2377 190 -781 798 -1389 1597 -1595 561 -145 1156 -91 1664 151 453 216 804 561 1020 1004 107 218 168 415 207 665 24 160 24 510 0 670 -80 514 -301 953 -662 1315 -358 358 -801 583 -1305 660 -101 15 -441 28 -525 19z m420 -349 c233 -27 452 -93 665 -200 727 -365 1161 -1157 1080 -1966 -71 -698 -484 -1266 -1120 -1542 -547 -237 -1200 -220 -1735 45 -737 365 -1134 1152 -1010 2004 155 1062 1073 1781 2120 1659z" />
            <path d="M1592 3154 c-123 -61 -202 -234 -189 -414 7 -99 29 -165 77 -236 97 -146 257 -176 376 -71 56 49 87 97 113 174 41 123 35 264 -18 386 -26 60 -104 145 -156 168 -60 28 -140 25 -203 -7z" />
            <path d="M2832 3154 c-213 -106 -261 -488 -87 -691 102 -120 272 -122 377 -5 121 134 146 380 56 555 -72 143 -221 203 -346 141z" />
            <path d="M1035 2023 c34 -289 152 -540 340 -728 410 -411 1158 -478 1662 -150 261 170 441 453 498 782 8 47 15 101 15 120 0 33 -2 35 -27 29 -446 -95 -969 -138 -1436 -116 -356 16 -674 51 -932 101 -137 26 -128 29 -120 -38z m307 -192 c324 -47 673 -71 1038 -71 363 0 628 21 894 71 59 11 110 18 113 15 8 -8 -53 -90 -101 -134 -127 -117 -315 -195 -571 -239 -155 -26 -598 -26 -765 0 -368 57 -663 189 -747 335 -30 50 -40 49 139 23z" />
          </g>
        </svg>
        <input
          className="w-4/5 bg-white dark:bg-WADarkTeal focus:outline-none caret-WATeal dark:text-white"
          type="text"
          placeholder="Message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <div
          id="input-anime-container"
          className={`ml-auto flex ${hasText ? "animate-hide-camera" : "animate-show-camera"}`}
        >
          <svg
            id="input-area-hairpin"
            className="w-6 h-6 mr-3"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 86.94 77.36"
          >
            <path
              className="fill-gray-400"
              fill="black"
              fillRule="nonzero"
              d="M-0 53.18l0 0.01c0,6.46 2.51,12.53 7.08,17.09 4.57,4.56 10.64,7.09 17.1,7.09 6.46,0 12.52,-2.51 17.09,-7.08l41.07 -41.08c3.31,-3.3 4.93,-7.6 4.55,-12.12 -0.34,-4.16 -2.36,-8.29 -5.67,-11.61 -6.86,-6.85 -17.5,-7.36 -23.73,-1.13l-34.05 34.05c-3.79,3.79 -3.41,9.68 0.92,14.03 4.13,4.12 10.42,4.53 14.04,0.93 0,0 16.42,-16.43 23.71,-23.71 1.2,-1.2 1.15,-3.11 0.23,-4.03 -0.34,-0.34 -0.71,-0.71 -1.05,-1.05 -0.82,-0.82 -2.44,-1.5 -4.12,0.17 -7.31,7.31 -23.69,23.69 -23.69,23.69 -0.77,0.77 -2.73,0.55 -4.2,-0.92 -0.42,-0.42 -2.48,-2.64 -0.92,-4.19l34.05 -34.06c3.52,-3.52 9.75,-3.01 13.9,1.13 2.15,2.16 3.45,4.73 3.65,7.25 0.22,2.47 -0.67,4.78 -2.53,6.64l-41.07 41.08c-3.25,3.26 -7.58,5.04 -12.17,5.04 -4.6,0 -8.92,-1.79 -12.18,-5.05 -3.25,-3.25 -5.04,-7.57 -5.04,-12.17l0 0c0,-4.61 1.79,-8.93 5.04,-12.18 0,0 22.9,-22.9 31.01,-31.02 0.67,-0.67 1.14,-2.49 0.12,-3.5 -0.59,-0.59 -0.9,-0.9 -1.47,-1.47 -0.86,-0.86 -2.38,-1.13 -3.59,0.08 -8.15,8.15 -31,31.01 -31,31.01 -4.56,4.56 -7.07,10.63 -7.07,17.08z"
            />
          </svg>
          <svg
            id="input-area-camera"
            className="w-6 h-6 mr-3"
            version="1.0"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 96 96"
            preserveAspectRatio="xMidYMid meet"
          >
            <g
              className="fill-gray-400"
              transform="translate(0,96) scale(0.1,-0.1)"
              fill="#000000"
              stroke="none"
            >
              <path d="M326 840 c-43 -39 -44 -40 -120 -40 -68 0 -80 -3 -101 -25 l-25 -24 0 -271 0 -271 25 -24 24 -25 351 0 351 0 24 25 25 24 0 271 0 271 -25 24 c-21 22 -33 25 -101 25 -76 0 -77 1 -120 40 l-44 40 -110 0 -110 0 -44 -40z m264 -194 c59 -39 85 -89 85 -166 0 -78 -26 -127 -88 -168 -56 -37 -153 -39 -210 -3 -76 47 -111 140 -88 229 14 51 75 117 123 131 53 16 135 6 178 -23z" />
              <path d="M435 591 c-45 -20 -70 -60 -70 -112 0 -42 5 -53 33 -81 28 -28 39 -33 82 -33 43 0 54 5 82 33 28 28 33 39 33 82 0 42 -5 54 -31 81 -33 33 -92 46 -129 30z" />
            </g>
          </svg>
        </div>
      </div>
      <div className="rounded-full w-11 h-11 bg-WATeal relative drop-shadow">
        <svg
          id="input-area-mic"
          className={`w-6 h-6 absolute top-0 left-0 right-0 bottom-0 m-auto transition-[scale] duration-500 ${hasText ? "scale-0" : "z-[1]"}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 56.45 76.62"
        >
          <path
            fill="white"
            fillRule="nonzero"
            d="M28.23 48.39c6.86,0 12.1,-5.24 12.1,-12.1l0 -24.19c0,-6.86 -5.24,-12.1 -12.1,-12.1 -6.86,0 -12.1,5.25 -12.1,12.1l0 24.19c0,6.86 5.24,12.1 12.09,12.1zm21.37 -12.1c0,12.1 -10.08,20.56 -21.37,20.56 -11.29,0 -21.37,-8.47 -21.37,-20.56l-6.86 0c0,13.71 10.89,25 24.19,27.02l0 13.31 8.07 0 0 -13.31c13.31,-2.01 24.19,-13.31 24.19,-27.02l-6.85 -0z"
          />
        </svg>
        <svg
          id="input-area-send-btn"
          className={`w-6 h-6 absolute top-0 left-0 right-0 bottom-0 m-auto transition-[scale] duration-500 ${hasText ? "z-[1]" : "scale-0"}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 331.49 284.14"
        >
          <polygon
            fill="white"
            fillRule="nonzero"
            points="-0,284.14 331.49,142.07 -0,0 0.16,115.54 199.1,142.07 0.16,168.6"
          />
        </svg>
      </div>
    </section>
  );
}

export function ChatBody() {
  return (
    <section className="chat-page">
      <div className="relative z-[1]">
        <div className="text-[8px] text-center mx-auto my-2 p-1 w-12 text-black dark:text-gray-400 bg-white dark:bg-WADarkTeal rounded-xl shadow-md">
          Today
        </div>
        <div className="text-[8px] text-center mx-auto my-2 p-2 w-80 text-black dark:text-gray-400 bg-WALightYellow dark:bg-WADarkTeal rounded-xl shadow-md">
          <Image
            className="inline-flex w-2 mb-[2px] mr-[1px]"
            src="/imgs/lock.svg"
            alt="lock"
            width={8}
            height={8}
          />
          Messages and calls are end-to-end encrypted. No one outside of this chat,
          not even WhatsApp, can read or listen to them. Tap to learn more
        </div>
      </div>
    </section>
  );
}
