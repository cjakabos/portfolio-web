import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const DashboardLayout = ({
                    children,
                    menuVariant,
                }: {
    children: React.ReactNode;
    menuVariant: any;
}) => {

    const pathname = usePathname();

    const currentSelection = "border-red-700  md:border-b-0 md:border-r-4 ";


    return (
        <>
                <div className="flex w-full  flex-col md:flex-row">
                    <div
                        className="sticky top-20 h-20 flex w-full bg-gray-200 dark:bg-gray-800 text-2xl font-bold md:h-1/6 md:w-1/6 md:flex-col md:rounded-2xl">
                        {menuVariant.map((i, idx) => {
                            return (
                                <>
                                    {(pathname == i.url) ? (
                                        <Link
                                            className={`flex w-100  h-[100px] items-center justify-center opacity-70 hover:opacity-100 ${currentSelection}`}
                                            href={`${i.url}`}
                                        >
                                            <button
                                                className="text-black dark:text-white">
                                                {i.caption}
                                            </button>
                                        </Link>
                                    ) : (
                                        <Link
                                            className={`flex h-[100px] items-center justify-center opacity-70 hover:opacity-100`}
                                            href={`${i.url}`}
                                        >
                                            <button
                                                className="text-black dark:text-white">
                                                {i.caption}
                                            </button>
                                        </Link>
                                    )}
                                </>
                            );
                        })}
                    </div>
                        <div className="flex  h-full w-full flex-col overflow-y-auto rounded-xl">
                            {children}
                        </div>

                </div>
        </>
    );
};

export default DashboardLayout;