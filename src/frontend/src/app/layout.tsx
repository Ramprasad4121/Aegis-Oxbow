import type { Metadata } from "next";
import "./globals.css";
import Web3Providers from "./providers";

export const metadata: Metadata = {
  title: "Aegis-Oxbow | Privacy-Preserving AI Gas Relayer",
  description:
    "Break on-chain transaction links with AI-powered batch execution on BNB Chain. Multiplies effective TPS by 100x.",
  keywords: ["BNB Chain", "privacy", "relayer", "paymaster", "AI", "batch", "gas"],
  openGraph: {
    title: "Aegis-Oxbow | AI Gas Relayer",
    description: "Privacy-preserving, AI-powered batch gas relayer on BNB Chain.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
      <script dangerouslySetInnerHTML={{ __html: `
        // Suppress errors injected by Chrome browser extensions (e.g. Coinbase Wallet).
        // These are not from our code and do not affect functionality.
        (function() {
          var _origOnError = window.onerror;
          window.onerror = function(msg, src) {
            if (src && src.startsWith('chrome-extension://')) return true;
            return _origOnError ? _origOnError.apply(this, arguments) : false;
          };
          window.addEventListener('unhandledrejection', function(e) {
            var src = e && e.reason && (e.reason.stack || '');
            if (src && src.includes('chrome-extension://')) e.preventDefault();
          }, true);
        })();
      ` }} />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Inter for UI text, Fira Code for mono numbers/addresses */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <Web3Providers>{children}</Web3Providers>
      </body>
    </html>
  );
}
