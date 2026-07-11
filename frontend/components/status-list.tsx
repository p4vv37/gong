import Image from "next/image";
import { statusItems } from "@/lib/data";

export function StatusList() {
  return (
    <section id="status">
      {statusItems.map((item, index) => (
        <div key={item.id}>
          {index === 0 ? (
            <div className="status flex justify-between">
              <div className="flex">
                <div className={item.ringClass}>
                  <Image
                    className="w-14 h-14 m-1.5 object-cover rounded-full"
                    src={item.img}
                    alt="my status"
                    width={56}
                    height={56}
                  />
                </div>
                <div className="flex flex-col gap-y-1 justify-center py-3 px-4">
                  <div className="dark:text-white text-sm font-bold text-black">
                    {item.name}
                  </div>
                  <div className="dark:text-gray-400 text-xs font-normal text-gray-900">
                    {item.time}
                  </div>
                </div>
              </div>
              <div className="grid place-items-center">
                <svg
                  className="transform rotate-90"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  height="24"
                  width="24"
                >
                  <path
                    fill="#54656F"
                    d="M12,7c1.104,0,2-0.896,2-2c0-1.105-0.895-2-2-2c-1.104,0-2,0.894-2,2 C10,6.105,10.895,7,12,7z M12,9c-1.104,0-2,0.894-2,2c0,1.104,0.895,2,2,2c1.104,0,2-0.896,2-2C13.999,9.895,13.104,9,12,9z M12,15 c-1.104,0-2,0.894-2,2c0,1.104,0.895,2,2,2c1.104,0,2-0.896,2-2C13.999,15.894,13.104,15,12,15z"
                  />
                </svg>
              </div>
            </div>
          ) : index === 1 ? (
            <>
              <div className="w-full px-3 py-2 text-left text-gray-900 dark:text-gray-400 text-xs font-medium">
                Recent updates
              </div>
              <div className="status">
                <div className="flex">
                  <div className={item.ringClass}>
                    <Image
                      className="w-14 h-14 m-1.5 object-cover rounded-full"
                      src={item.img}
                      alt="status"
                      width={56}
                      height={56}
                    />
                  </div>
                  <div className="flex flex-col gap-y-1 justify-center py-3 px-4">
                    <div className="dark:text-white text-sm font-bold text-black">
                      {item.name}
                    </div>
                    <div className="dark:text-gray-400 text-xs font-normal text-gray-900">
                      {item.time}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="status">
              <div className="flex">
                <div className={item.ringClass}>
                  <Image
                    className="w-14 h-14 m-1.5 object-cover rounded-full"
                    src={item.img}
                    alt="status"
                    width={56}
                    height={56}
                  />
                </div>
                <div className="flex flex-col gap-y-1 justify-center py-3 px-4">
                  <div className="dark:text-white text-sm font-bold text-black">
                    {item.name}
                  </div>
                  {item.timeDesktop ? (
                    <>
                      <div className="md:hidden dark:text-gray-400 text-xs font-normal text-gray-900">
                        {item.time}
                      </div>
                      <div className="hidden md:block dark:text-gray-400 text-xs font-normal text-gray-900">
                        {item.timeDesktop}
                      </div>
                    </>
                  ) : (
                    <div className="dark:text-gray-400 text-xs font-normal text-gray-900">
                      {item.time}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
