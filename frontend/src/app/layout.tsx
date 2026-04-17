import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AppShell } from "@/components/layout/AppShell";
import { PWARegister } from "@/components/pwa/PWARegister";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

export const metadata: Metadata = {
  title: "Autoscar CRM",
  description: "CRM de atendimento automotivo com IA",
  manifest: "/manifest.webmanifest",
  applicationName: "Autoscar CRM",
  appleWebApp: {
    capable: true,
    title: "Autoscar",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  // icon.png and apple-icon.png in src/app are picked up automatically by Next
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <AppShell>{children}</AppShell>
              <InstallPrompt />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
        <PWARegister />
      </body>
    </html>
  );
}
