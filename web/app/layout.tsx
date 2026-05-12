import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monad Mogs",
  description: "5,000 sold out fully onchain pixel hamsters on Monad.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
