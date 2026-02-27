/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'selector',
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './**/*.{js,ts,jsx,tsx,mdx}',
    ],
    safelist: [
      // Layout & Display
      'flex', 'flex-1', 'flex-col', 'flex-wrap', 'hidden', 'block', 'inline-block',
      'md:flex', 'md:hidden',

      // ===========================================
      // REMOTE MICROFRONTEND CLASSES — Chat (ChatLLM / Jira)
      // ===========================================
      // Bubble backgrounds
      'bg-green-300', 'dark:bg-green-300',   // user message
      'bg-blue-300', 'dark:bg-blue-300',     // AI reasoning
      'bg-gray-300',                          // AI response
      'bg-green-600',                         // AI avatar
      // Bubble text
      'text-black',
      // Bubble shape & layout
      'flex-row-reverse',
      'rounded-2xl', 'rounded-tr-none', 'rounded-tl-none',
      'max-w-[80%]', 'max-w-[85%]',
      'leading-relaxed',
      'shrink-0',
      'w-8', 'h-8',
      'w-2', 'h-2',
      'animate-bounce', 'animate-spin',
      // Alert colors (ChatLLM / Jira error states)
      'dark:bg-red-900/20', 'border-red-200', 'dark:border-red-800',
      'bg-amber-50', 'dark:bg-amber-900/20', 'border-amber-200', 'dark:border-amber-800',
      'dark:bg-blue-900/20', 'border-blue-200', 'dark:border-blue-800',
      'text-red-800', 'dark:text-red-200', 'text-amber-800', 'dark:text-amber-200',
      'text-blue-800', 'dark:text-blue-200',
      'dark:text-red-400', 'text-amber-600', 'dark:text-amber-400',
      'dark:text-blue-400',
      'bg-red-100', 'dark:bg-red-800', 'dark:bg-red-700',
      'dark:bg-green-900/30', 'text-green-600', 'dark:text-green-400',
      'dark:text-green-300',
      'bg-amber-600', 'hover:bg-amber-700',
      'bg-purple-100', 'dark:bg-purple-800', 'text-purple-700', 'dark:text-purple-300',
      'bg-green-800', 'dark:bg-green-800', 'bg-blue-800', 'dark:bg-blue-800',
      'text-blue-700', 'dark:text-blue-300',

      // ===========================================
      // REMOTE MICROFRONTEND CLASSES (OpenMaps/Fleet Manager)
      // ===========================================
      'lg:flex-row',
      'lg:w-1/3',
      'lg:opacity-0',
      'lg:group-hover:opacity-100',
      'lg:max-h-none',
      'gap-6',
      'group',
      'items-start',
      'capitalize',
      'font-mono',
      'w-fit',
      'shadow-inner',
      'inset-0',
      'backdrop-blur',
      'backdrop-blur-sm',
      'pointer-events-none',
      'top-4',
      'left-14',
      'p-1',
      'p-1.5',
      'p-3',
      'p-5',
      'p-6',
      'py-0.5',
      'py-2.5',
      'pt-2',
      'mt-2',
      'mt-10',
      'mb-1',
      'space-y-4',
      'gap-4',
      'text-[10px]',
      'text-blue-600',
      'text-green-700',
      'text-amber-700',
      'text-red-600',
      'text-gray-400',
      'bg-blue-600',
      'bg-blue-50',
      'bg-red-50',
      'bg-green-100',
      'bg-amber-100',
      'bg-black/60',
      'bg-white/90',
      'hover:bg-blue-700',
      'hover:text-blue-600',
      'hover:text-red-600',
      'hover:shadow-md',
      'border-gray-100',
      'border-gray-300',
      'rounded-md',
      'shadow-2xl',
      'shadow-lg',
      'shadow-blue-600/30',
      'outline-none',
      'transform',
      'transition-all',
      'transition-opacity',
      'overflow-hidden',
      'overflow-y-auto',
      'grid',
      'grid-cols-2',
      'dark:bg-gray-900',
      'dark:bg-gray-900/50',
      'dark:bg-black/70',
      'dark:border-gray-600',
      'dark:hover:text-gray-200',
      'focus:ring-2',
      'focus:ring-blue-500',
      'z-0',
      'z-[400]',
      'z-[1000]',
      // ===========================================

      // Positioning
      'fixed', 'relative', 'absolute', 'z-10', 'z-20',
      'top-28', 'bottom-0', 'left-0', 'right-0',

      // Sizing
      'h-full', 'h-12', 'h-screen', 'w-full', 'w-64',
      'max-w-6xl', 'max-w-md',

      // Spacing
      'p-2', 'p-4', 'p-6', 'px-3', 'px-4', 'py-1', 'py-2', 'py-3',
      'mt-1', 'mb-2', 'mb-4',
      'mx-auto',
      'gap-2', 'gap-3',
      'space-y-1', 'space-y-6',
      'md:p-8', 'pt-44', 'md:pt-8',

      // Flexbox alignment
      'items-center', 'justify-between', 'justify-around', 'justify-center',

      // Typography
      'text-xs', 'text-sm', 'text-lg', 'text-xl', 'text-3xl',
      'font-bold', 'font-medium', 'font-semibold',
      'uppercase',

      // Colors - Text
      'text-white',
      'text-gray-500', 'text-gray-600', 'text-gray-700', 'text-gray-900',
      'text-indigo-400', 'text-indigo-500', 'text-indigo-600', 'text-indigo-700',
      'text-emerald-800', 'text-blue-800',
      'dark:text-white', 'dark:text-gray-400', 'dark:text-indigo-300', 'dark:text-indigo-400',

      // Colors - Background
      'bg-white', 'bg-gray-50', 'bg-gray-100',
      'bg-slate-50',
      'bg-indigo-50', 'bg-emerald-100', 'bg-emerald-600', 'bg-blue-100',
      'dark:bg-gray-700', 'dark:bg-gray-800',

      // Hover states
      'hover:bg-gray-50', 'hover:bg-emerald-700',
      'hover:text-gray-900', 'hover:text-white', 'hover:underline',
      'dark:hover:bg-gray-700', 'dark:hover:text-white',

      // Borders
      'border', 'border-r', 'border-b', 'border-t', 'border-none',
      'border-gray-100', 'border-gray-200', 'border-gray-300',
      'border-emerald-300', 'border-blue-300',
      'dark:border-gray-700',

      // Border Radius
      'rounded', 'rounded-lg', 'rounded-xl', 'rounded-full',

      // Effects
      'shadow-sm',
      'transition', 'transition-colors',
      'duration-200',

      // Overflow
      'overflow-auto',

      // Safe area (mobile)
      'pb-safe',
    ],
    prefix: "",
    theme: {
        transparent: "transparent",
        current: "currentColor",
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic':
                    'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
            },
        }
    },
    plugins: [require("tailwindcss-animate")],
};