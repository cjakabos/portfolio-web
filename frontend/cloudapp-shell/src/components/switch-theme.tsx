import React, { useEffect } from "react";
import { useTheme } from "next-themes";
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';

interface SwitchThemeProps {
  clases?: string;
}

const SwitchTheme: React.FC<SwitchThemeProps> = ({ ...props }) => {
  const { setTheme, theme } = useTheme();

  const { clases } = props;

  useEffect(() => {
    const moonStars = document.getElementById("moonStars");
    const sun = document.getElementById("sun");

    if (theme === "light") {
      moonStars?.classList.add("hidden");
      sun?.classList.remove("hidden");
    } else {
      moonStars?.classList.remove("hidden");
      sun?.classList.add("hidden");
    }
  }, [theme]);

  return (
      <div className="order-1 flex lg:order-none w-[100px]">
        <button className="ml-10 self-center  opacity-70 hover:opacity-100 lg:block">
            <LightModeIcon
                id="moonStars"
                onClick={() => setTheme("light")}
                fontSize="medium"
            />
            <DarkModeIcon
                id="sun"
                onClick={() => setTheme("dark")}
                fontSize="medium"
            />
        </button>
      </div>
  );
};

export default SwitchTheme;
