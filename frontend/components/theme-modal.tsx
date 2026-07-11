"use client";

import { useTheme } from "@/components/theme-provider";

export function ThemeModal() {
  const {
    setTheme,
    showThemeModal,
    modalSelection,
    setModalSelection,
    closeThemeModal,
  } = useTheme();

  if (!showThemeModal) {
    return null;
  }

  const handleOk = () => {
    setTheme(modalSelection);
    closeThemeModal();
  };

  return (
    <div
      id="theme-modal-bg"
      className="theme-modal-bg z-50"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeThemeModal();
        }
      }}
    >
      <div
        id="theme-modal"
        className="p-4 w-9/12 md:max-w-[40%] lg:max-w-[30%] bg-white dark:bg-WADarkTeal md:drop-shadow-xl"
      >
        <div className="text-black dark:text-white py-2 text-lg font-medium">
          Choose theme
        </div>
        {(["default", "light", "dark"] as const).map((value) => (
          <div key={value} className={`flex items-center ${value !== "default" ? "mt-2" : ""}`}>
            <input
              className="theme"
              type="radio"
              name="theme"
              id={value}
              value={value}
              checked={modalSelection === value}
              onChange={() => setModalSelection(value)}
            />
            <label className="text-black dark:text-white" htmlFor={value}>
              {value === "default"
                ? "System default"
                : value.charAt(0).toUpperCase() + value.slice(1)}
            </label>
          </div>
        ))}
        <div className="flex justify-end">
          <button
            type="button"
            className="theme-select-btn flex text-WATeal p-2 hover:bg-gray-200 mr-3 md:px-4 cursor-pointer md:border-gray-100 dark:md:border-[#27353f] md:rounded-sm md:border-2 md:hover:bg-inherit md:transition-shadow md:duration-300 md:hover:shadow-md"
            onClick={closeThemeModal}
          >
            Cancel
          </button>
          <button
            type="button"
            className="theme-select-btn flex text-WATeal p-2 hover:bg-gray-200 md:px-6 md:items-center cursor-pointer md:rounded-sm md:text-white dark:md:text-WADarkTeal md:bg-WATeal md:hover:bg-WATeal md:transition-shadow md:duration-300 md:hover:shadow-md"
            onClick={handleOk}
          >
            Ok
          </button>
        </div>
      </div>
    </div>
  );
}
