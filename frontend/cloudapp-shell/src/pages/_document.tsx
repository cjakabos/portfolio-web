import { Html, Main, Head, NextScript } from "next/document";

export default function Document() {
  const themeInitScript = `
    (function () {
      try {
        var pref = localStorage.getItem('themePreference');
        var legacy = localStorage.getItem('theme');
        var media = window.matchMedia('(prefers-color-scheme: dark)');
        var isDark = pref === 'dark' || (pref !== 'light' && (pref === 'system' ? media.matches : legacy === 'dark' || media.matches));
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
      } catch (_) {}
    })();
  `;

  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="color-scheme" content="dark light" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
