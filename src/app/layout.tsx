import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Cinzel, Geist, Geist_Mono, Newsreader } from "next/font/google";
import { SiteShell } from "@/components/site-shell";
import { ThemeBoot } from "@/components/theme-boot";
import { APP_NAME, SUPPORTING_COPY, TAGLINE } from "@/lib/constants";
import { isSimulation } from "@/lib/env";
import { parseTheme, THEME_COOKIE } from "@/lib/design/theme";
import { colors, themes } from "@/lib/design/tokens";
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

const display = Newsreader({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
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
  interactiveWidget: "resizes-content" as const,
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang="en"
      data-theme={theme}
      data-scheme={themes[theme].scheme}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${cinzel.variable} h-full antialiased`}
    >
      <body className="grain min-h-full bg-stone font-sans text-paper">
        <ThemeBoot />
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
