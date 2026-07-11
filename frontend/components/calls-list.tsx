import Image from "next/image";
import type { CallItem } from "@/lib/types";

type CallsListProps = {
  calls: CallItem[];
};

export function CallsList({ calls }: CallsListProps) {

  return (
    <section id="calls">
      <div className="flex justify-start px-3 py-3 space-x-3 transition bg-white dark:bg-WADarkGreen hover:bg-gray-200 hover:dark:bg-WADarkTeal cursor-default">
        <div className="grid place-items-center">
          <div className="rounded-full grid place-items-center bg-WATeal w-12 h-12 cursor-pointer">
            <Image
              width={20}
              height={20}
              className="w-5 h-5 filter invert sepia-0 saturate-[7491%] hue-rotate-[349deg] brightness-100 contrast-100"
              src="https://img.icons8.com/external-tal-revivo-bold-tal-revivo/24/external-online-web-link-attach-with-url-information-text-bold-tal-revivo.png"
              alt="link"
              unoptimized
            />
          </div>
        </div>
        <div className="flex flex-col justify-center text-sm">
          <div className="font-bold text-black dark:text-white">Create call link</div>
          <div className="font-normal text-gray-900 dark:text-gray-400 mt-1">
            Share link for your Whatsapp call
          </div>
        </div>
      </div>

      <div className="text-black dark:text-white text-sm font-bold px-3 py-1">
        Recent
      </div>

      <div aria-labelledby="calls">
        {calls.map((call) => (
          <div key={call.id} className="recent-calls">
            <div className="flex space-x-3">
              <div>
                <Image
                  src={call.img}
                  alt={call.name}
                  className="rounded-full object-cover w-14 h-14"
                  width={56}
                  height={56}
                />
              </div>
              <div className="flex flex-col justify-center space-y-1 text-sm">
                <div className="font-bold text-black dark:text-white">{call.name}</div>
                <div className="flex space-x-1">
                  <p className={call.missed ? "text-red-500" : "text-green-500"}>
                    {call.direction === "outgoing" ? "↗" : "↙"}
                  </p>
                  <div className="font-normal text-gray-900 dark:text-gray-400">
                    {call.time}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid place-items-center">
              <Image
                className="w-6 h-6 cursor-pointer"
                width={24}
                height={24}
                src="/imgs/icons8-phone-96.png"
                alt="phone"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
