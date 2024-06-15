import React from "react";
import Link from "next/link";
import Image from "next/image";
import imgLogo from "../../public/drawing.svg";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import type { NextPageWithLayout } from './_app'

const Home: NextPageWithLayout = () => {

  return (
      <div>
          <div className="flex items-center justify-center">
              <Link href="/">
                  <Image
                      src={imgLogo}
                      width={200}
                      height={200}
                      alt="Logo"
                      className="dark:invert mb-6 transition ease-in-out duration-300 hover:transform hover:scale-105 cursor-pointer"
                      quality={100}
                  />
              </Link>
          </div>
          <div className="flex items-center justify-center">
              <h1 className="text-4xl font-bold">
                  Portfolio webpage - CloudApp
              </h1>
          </div>
      </div>
  );
};

export default Home;
