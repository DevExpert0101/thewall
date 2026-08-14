import type { Metadata } from "next";
import { Cinzel, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { SiteShell } from "@/components/site-shell";
import { APP_NAME, SUPPORTING_COPY, TAGLINE } from "@/lib/constants";
import { isSimulation } from "@/lib/env";
import { THEME_BOOT_SCRIPT } from "@/lib/design/theme";
import { colors, DEFAULT_THEME } from "@/lib/design/tokens";
import { siteUrl } from "@/lib/utils";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const url = siteUrl();

export const viewport = {
  themeColor: colors.void,
};

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: {
    default: `${APP_NAME} — ${TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description: SUPPORTING_COPY,
  applicationName: APP_NAME,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} — ${TAGLINE}`,
    description: SUPPORTING_COPY,
    url,
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — ${TAGLINE}`,
    description: SUPPORTING_COPY,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrument.variable} ${cinzel.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="grain min-h-full bg-stone font-sans text-paper">
        <div className="atmosphere" aria-hidden="true">
          <div className="atmosphere-glow" />
        </div>
        <div className="relative z-10 min-h-full">
          <SiteShell simulation={isSimulation()}>{children}</SiteShell>
        </div>
      </body>
    </html>
  );
}
