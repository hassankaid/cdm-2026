import type { Metadata, Viewport } from "next";
import { Anton, Manrope } from "next/font/google";
import "./globals.css";

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mondial 26 — Pronos entre potes",
  description:
    "L'app de pronostics de la Coupe du Monde 2026. Pronostique, défie tes amis, vis chaque match en direct.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mondial 26",
  },
};

export const viewport: Viewport = {
  themeColor: "#060d0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${anton.variable} ${manrope.variable}`}>
      <body className="grain min-h-dvh antialiased">{children}</body>
    </html>
  );
}
