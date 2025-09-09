import React, { useState } from "react";
import { useTheme } from "next-themes";
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';

interface SwitchThemeProps {
    clases?: string;
}

const SwitchTheme: React.FC<SwitchThemeProps> = ({ ...props }) => {
    const { setTheme, theme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    const { clases } = props;

    // Only render after mounting to avoid hydration mismatch
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        // Return a placeholder that matches the server-side render
        return (
            <div className="layoutLinksFormat">
                <button className="ml-10 self-center opacity-70 hover:opacity-100 lg:block">
                    <div className="w-6 h-6"></div>
                </button>
            </div>
        );
    }

    return (
        <div className="layoutLinksFormat">
            <button className="ml-10 self-center opacity-70 hover:opacity-100 lg:block">
                {(theme === "dark" || resolvedTheme === "dark") && (
                    <LightModeIcon
                        onClick={() => setTheme("light")}
                        fontSize="medium"
                    />
                )}
                {(theme === "light" || resolvedTheme === "light") && (
                    <DarkModeIcon
                        style={{ color: 'white' }}
                        onClick={() => setTheme("dark")}
                        fontSize="medium"
                    />
                )}
            </button>
        </div>
    );
};

export default SwitchTheme;