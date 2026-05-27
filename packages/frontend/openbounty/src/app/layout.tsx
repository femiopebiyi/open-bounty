import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

import { WalletProviders } from "@/components/wallet/WalletProviders";
import { QueryProvider } from "@/components/QueryProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: {
    default: "OpenBounty, GitHub bounties on Solana",
    template: "%s · OpenBounty",
  },
  description:
    "Post bounties on GitHub issues. Get them solved by the best developers. Trustless escrow on Solana.",
  openGraph: {
    title: "OpenBounty",
    description: "GitHub bounties, settled on-chain.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-white antialiased">
        <QueryProvider>
          <WalletProviders>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  fontFamily: "var(--font-geist-sans)",
                  fontSize: "13px",
                  borderRadius: "10px",
                  border: "1px solid #E4E4E7",
                  boxShadow: "0 4px 16px rgb(0 0 0 / 0.06)",
                  padding: "12px 14px",
                },
                className: "!font-sans",
              }}
            />
          </WalletProviders>
        </QueryProvider>
      </body>
    </html>
  );
}
