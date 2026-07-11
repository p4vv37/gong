import Image from "next/image";

export function DefaultPanel() {
  return (
    <div
      id="column-2-default-inner"
      className="dark:bg-WADarkTeal border-b-WADarkGreen2 dark:border-b-WATeal flex flex-col w-full h-screen bg-gray-200 border-b-8"
    >
      <div className="mt-[25vh] flex justify-center">
        <Image
          className="dark:hidden"
          src="/imgs/mobile-and-desktop-light.svg"
          alt="mobile and desktop"
          width={320}
          height={200}
        />
        <Image
          className="dark:block hidden"
          src="/imgs/mobile-and-desktop-dark.svg"
          alt="mobile and desktop"
          width={320}
          height={200}
        />
      </div>
      <div className="mt-7 dark:text-gray-50 mx-auto text-2xl font-thin text-center text-gray-600">
        WhatsApp Web
      </div>
      <div className="dark:text-gray-400 mx-auto mt-4 text-xs text-center text-gray-600">
        Send and receive messages without keeping your phone online.
      </div>
      <div className="dark:text-gray-400 mx-auto text-xs text-center text-gray-600">
        Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
      </div>
      <div className="dark:text-gray-400 mx-auto mt-12 text-xs text-center text-gray-600">
        <Image
          className="inline-flex w-3 mb-[2px] mr-[1px]"
          src="/imgs/lock.svg"
          alt="lock"
          width={12}
          height={12}
        />
        End-to-end encrypted
      </div>
    </div>
  );
}
