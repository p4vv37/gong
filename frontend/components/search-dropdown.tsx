"use client";

import Image from "next/image";

const searchFilters = [
  {
    label: "Photos",
    icon: "https://img.icons8.com/material-sharp/96/null/image-gallery.png",
  },
  {
    label: "Video",
    icon: "https://img.icons8.com/external-kmg-design-glyph-kmg-design/64/null/external-video-ui-essentials-kmg-design-glyph-kmg-design.png",
  },
  {
    label: "Links",
    icon: "https://img.icons8.com/material-rounded/96/null/link--v1.png",
  },
  {
    label: "Gifs",
    icon: "https://img.icons8.com/ios-glyphs/90/null/attach-gif.png",
  },
  {
    label: "Audio",
    icon: "https://img.icons8.com/external-smashingstocks-glyph-smashing-stocks/100/null/external-headphone-network-and-communication-smashingstocks-glyph-smashing-stocks.png",
  },
  {
    label: "Documents",
    icon: "https://img.icons8.com/external-tanah-basah-glyph-tanah-basah/96/null/external-documents-design-thinking-tanah-basah-glyph-tanah-basah.png",
  },
];

type SearchDropdownProps = {
  open: boolean;
  showFilters: boolean;
  onClose: () => void;
};

export function SearchDropdown({ open, showFilters, onClose }: SearchDropdownProps) {
  return (
    <div className="relative md:fixed w-full md:w-2/5 z-10">
      <div
        id="search-dropdown"
        className={`fixed md:absolute top-0 bg-white shadow-md dark:bg-WADarkTeal px-4 py-2 w-full transition-transform duration-500 ${
          open ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div
          className={`flex py-3 ${showFilters ? "border-b-2 dark:border-b-0 border-b-gray-200" : ""}`}
        >
          <button type="button" className="grid place-content-center" onClick={onClose}>
            <Image
              id="search-back-btn"
              className="w-5 mr-4"
              src="https://img.icons8.com/android/96/null/left.png"
              alt="back icon"
              width={20}
              height={20}
              unoptimized
            />
          </button>
          <input
            className="grow bg-inherit focus:outline-none dark:text-white caret-WATeal"
            type="text"
            placeholder="Search..."
          />
        </div>

        {showFilters ? (
          <div className="flex flex-wrap whitespace-nowrap py-2">
            {searchFilters.map((filter) => (
              <div key={filter.label} className="search-item">
                <div className="flex items-center space-x-1.5">
                  <div className="w-2 h-2 search-item-img">
                    <Image
                      src={filter.icon}
                      alt={filter.label}
                      width={16}
                      height={16}
                      unoptimized
                    />
                  </div>
                  <div className="text-[10px] text-[#434f56] dark:text-[#c1d1db]">
                    {filter.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
