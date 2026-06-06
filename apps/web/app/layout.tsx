import type { Metadata } from "next";
import { Jersey_10, Inter } from "next/font/google";
import { ClientProviders } from "@/components/client-providers";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const pixelFont = Jersey_10({
  subsets: ["latin"],
  variable: "--font-pixel",
  weight: "400",
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Monad Mogs",
  description: "5,000 sold out fully onchain pixel hamsters on Monad.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${pixelFont.variable} ${bodyFont.variable}`}>
        <ClientProviders>
          {children}
          <SiteFooter />
        </ClientProviders>
      </body>
    </html>
  );
}
