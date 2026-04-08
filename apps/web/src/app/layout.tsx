import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaBoot } from "@/components/pwa-boot";

export const metadata: Metadata = {
  applicationName: "Ziggy",
  title: "Ziggy",
  description: "Run your day with clear guardrails.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ziggy",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", type: "image/svg+xml", sizes: "192x192" },
      { url: "/icons/icon-512.svg", type: "image/svg+xml", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.svg", type: "image/svg+xml", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#6f8594",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PwaBoot />
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <nav style={{
            width: "240px",
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            padding: "32px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            background: "rgba(255, 253, 249, 0.72)",
            backdropFilter: "blur(12px)",
          }}>
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--navy)", letterSpacing: "-0.02em" }}>Ziggy</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px", lineHeight: 1.5 }}>
                Governed agent runtime
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "10px", lineHeight: 1.6 }}>
                Risk-first, local-first, and human-reviewed by default.
              </div>
            </div>
            <a href="/" style={navLinkStyle}>Daily Tasks</a>
            <a href="/runs" style={navLinkStyle}>Activity</a>
            <a href="/preferences" style={navLinkStyle}>Governance & Preferences</a>
          </nav>
          <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

const navLinkStyle = {
  display: "block",
  padding: "10px 12px",
  borderRadius: "10px",
  color: "var(--text-muted)",
  fontSize: "14px",
  textDecoration: "none",
  background: "rgba(255,255,255,0.45)",
} as const;
