import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/ui/nav";
import { Footer } from "@/components/ui/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { APP_NAME } from "@/lib/constants";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} - AI-Powered Kubernetes Management`,
    template: `%s | ${APP_NAME}`,
  },
  description:
    "AI-powered Kubernetes management platform with built-in security scanning, multi-cluster support, and intelligent insights. Free & Open Source.",
  keywords: [
    "Kubernetes",
    "K8s",
    "Dashboard",
    "AI",
    "DevOps",
    "Monitoring",
    "Security",
    "Trivy",
    "Helm",
    "Multi-cluster",
    "Open Source",
  ],
  authors: [{ name: "NextSight AI Team" }],
  creator: "NextSight AI",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://nextsight.dev",
    title: `${APP_NAME} - AI-Powered Kubernetes Management`,
    description:
      "AI-powered Kubernetes management platform with built-in security scanning and intelligent insights.",
    siteName: APP_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} - AI-Powered Kubernetes Management`,
    description:
      "AI-powered Kubernetes management platform with built-in security scanning and intelligent insights.",
    creator: "@nextsightai",
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' }
    ],
    apple: '/apple-icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <Nav />
          <main>{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
