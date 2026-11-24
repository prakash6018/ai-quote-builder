import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = { title: "QuoteBench", description: "Quotes from engineering drawings" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="border-b border-stone-300/70 bg-white">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
              <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
                <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                  <rect x="1" y="1" width="20" height="20" rx="4" className="fill-blueprint" />
                  <path d="M5 15h12M5 15V7m4 8v-4m4 4V9m4 6V5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                QuoteBench
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                <Link href="/" className="rounded-md px-3 py-1.5 text-stone-600 hover:bg-stone-100 hover:text-ink">Quotes</Link>
                <Link href="/quotes/new" className="rounded-md bg-ink px-3 py-1.5 font-medium text-white hover:bg-stone-800">New quote</Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-6 py-7">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
