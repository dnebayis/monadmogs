import type { Metadata } from "next";
import { Jersey_10 } from "next/font/google";
import "./globals.css";

const pixelFont = Jersey_10({
  subsets: ["latin"],
  variable: "--font-pixel",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Monad Mogs",
  description: "5,000 sold out fully onchain pixel hamsters on Monad.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={pixelFont.variable}>
        {children}
      </body>
    </html>
  );
}
