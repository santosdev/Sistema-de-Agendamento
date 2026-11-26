import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { themeScript } from "@/components/theme/theme-script";
import { ToastProvider } from "@/components/ui/toast";
import { DEFAULT_LOCALE, getMessages } from "@/lib/i18n";
import "./globals.css";

/** Satoshi and Clash Display (Fontshare, free license), the agency's type pair. */
const satoshi = localFont({
  variable: "--font-satoshi",
  display: "swap",
  src: [
    { path: "./fonts/Satoshi-Regular.woff2", weight: "400" },
    { path: "./fonts/Satoshi-Medium.woff2", weight: "500" },
    { path: "./fonts/Satoshi-Bold.woff2", weight: "700" },
  ],
});

const clashDisplay = localFont({
  variable: "--font-clash-display",
  display: "swap",
  src: [
    { path: "./fonts/ClashDisplay-Semibold.woff2", weight: "600" },
    { path: "./fonts/ClashDisplay-Bold.woff2", weight: "700" },
  ],
});

const t = getMessages();

/** Absolute base for Open Graph URLs. Read directly so builds without env still work. */
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: t.meta.title, template: `%s · ${t.meta.title}` },
  description: t.meta.description,
  applicationName: t.meta.title,
  openGraph: {
    type: "website",
    siteName: t.meta.title,
    locale: "pt_BR",
    title: t.meta.title,
    description: t.meta.description,
  },
  twitter: { card: "summary_large_image", title: t.meta.title, description: t.meta.description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5FC" },
    { media: "(prefers-color-scheme: dark)", color: "#07021A" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      className={`${satoshi.variable} ${clashDisplay.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Sets html.dark before paint (no theme flash). */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-3 focus:shadow-pop"
        >
          {t.common.skipToContent}
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
