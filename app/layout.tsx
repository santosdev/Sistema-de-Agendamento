import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { DEFAULT_LOCALE, getMessages } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const t = getMessages();

export const metadata: Metadata = {
  title: { default: t.meta.title, template: `%s · ${t.meta.title}` },
  description: t.meta.description,
};

export const viewport: Viewport = {
  themeColor: "#F6F4FB",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={DEFAULT_LOCALE} className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-3 focus:shadow-pop"
        >
          {t.common.skipToContent}
        </a>
        {children}
      </body>
    </html>
  );
}
