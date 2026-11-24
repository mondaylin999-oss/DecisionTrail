import type { Metadata } from "next";
import { Suspense } from "react";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

// Self-hosted fonts: builds work offline and send no requests to Google Fonts.
const geistSans = GeistSans;
const geistMono = GeistMono;
const themeBootstrap = `try {
  const savedTheme = localStorage.getItem("decisiontrail-theme");
  const isDark = savedTheme ? savedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", isDark);
} catch {}`;

export const metadata: Metadata = {
  title: "DecisionTrail: Learn From the Past. Decide With Confidence.",
  description: "A privacy-first decision workspace: personal decision history, documented historical cases and consented live research, with hybrid on-device AI.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full">
          <AuthProvider>
            {/* The app is client-rendered per user; the shell reads the URL, so it streams in. */}
            <Suspense fallback={null}>
              <AppShell>{children}</AppShell>
            </Suspense>
          </AuthProvider>
      </body>
    </html>
  );
}
