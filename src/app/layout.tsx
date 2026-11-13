import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { RootProviders } from "@/components/root-providers";
import { ThemeScript } from "@/components/ui/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face (Iosevka Charon, SIL OFL), self-hosted
const iosevka = localFont({
  variable: "--font-iosevka",
  display: "swap",
  src: [
    { path: "./fonts/iosevka-charon-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/iosevka-charon-700.woff2", weight: "700", style: "normal" },
  ],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://tbo-assemble.vercel.app"),
  title: {
    default: "TBO | Inventory Intelligence",
    template: "%s | TBO Inventory Intelligence",
  },
  description:
    "An illustrative travel inventory procurement, demand forecasting and budget allocation dashboard.",
  keywords: [
    "group travel",
    "MICE",
    "hotel room block",
    "wedding management",
    "TBO",
    "travel technology",
    "attrition management",
    "room allocation",
  ],
  authors: [{ name: "TBO Assemble" }],
  openGraph: {
    title: "TBO Assemble — Smart Group Travel OS",
    description:
      "AI-powered hotel room block management for MICE events and destination weddings. Replace spreadsheets with intelligence.",
    type: "website",
    siteName: "TBO Assemble",
    locale: "en_IN",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "TBO Assemble Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TBO Assemble — Smart Group Travel OS",
    description:
      "AI-powered hotel room block management for MICE events and destination weddings.",
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "64x64" },
    ],
    apple: "/logo.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${iosevka.variable} antialiased`}
        suppressHydrationWarning
      >
        <RootProviders>{children}</RootProviders>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && location.hostname === 'localhost') {
                console.log(
                  "%c🏨 TBO Assemble %c Group Travel OS ",
                  "background: linear-gradient(135deg, #ea580c, #c2410c); color: white; font-size: 16px; font-weight: bold; padding: 8px 12px; border-radius: 6px 0 0 6px;",
                  "background: #1e293b; color: #94a3b8; font-size: 12px; padding: 8px 12px; border-radius: 0 6px 6px 0;"
                );
                console.log(
                  "%cBuilt with ❤️ by Team IIITDards for VOYAGEHACK 3.0\\nPowered by Next.js 16 · GPT-4o · Prisma 7 · Tailwind v4",
                  "color: #64748b; font-size: 11px; line-height: 1.6;"
                );
              }
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
