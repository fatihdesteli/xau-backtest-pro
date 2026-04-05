import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "XAU Backtest Pro",
  description: "Professional forex backtesting system for XAUUSD",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full">
      <body className={`${inter.className} h-full overflow-hidden bg-[#0d0d0d] text-gray-200`}>
        {children}
      </body>
    </html>
  );
}
