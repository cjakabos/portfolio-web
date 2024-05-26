import React from "react";
import Link from "next/link";
import Image from "next/image";
import imgLogo from "../../public/drawing.svg";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";

const Home: React.FC = () => {

  return (
    <motion.main
      initial={{ opacity: 0, y: -15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="grid grid-col-1 lg:grid-cols-2 gap-4 lg:gap-10 min-h-[100vh] max-w-[1440px] m-auto overflow-hidden"
    >
      <section className="px-10 pt-10 pb-4 lg:p-10 flex justify-center flex-col">
        <Link href="/">
          <Image
            src={imgLogo}
            width={80}
            height={80}
            alt="Logo"
            className="mb-6 transition ease-in-out duration-300 hover:transform hover:scale-105 cursor-pointer"
            quality={100}
          />
        </Link>
        <h1 className="text-4xl font-bold">
          Portfolio webpage - CloudApp
        </h1>
      </section>
    </motion.main>
  );
};

export default Home;
