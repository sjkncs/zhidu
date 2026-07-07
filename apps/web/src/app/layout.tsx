import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { RegisterSW } from "@/components/pwa/register-sw";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { UpdateNotification } from "@/components/pwa/update-notification";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1117" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://zhidu.app'),
  title: {
    default: '知渡 - AI 志愿填报与大学生成长平台',
    template: '%s | 知渡',
  },
  description: '从高考志愿到人生规划，AI 驱动的个人成长操作系统。智能匹配院校专业，科学规划志愿方案，全程陪伴大学生成长。',
  keywords: ['高考志愿', 'AI志愿填报', '大学专业选择', '生涯规划', '学业管理', 'GPA计算', '大学生成长平台'],
  authors: [{ name: '知渡团队' }],
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '知渡',
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: '知渡',
    title: '知渡 - AI 志愿填报与大学生成长平台',
    description: '从高考志愿到人生规划，AI 驱动的个人成长操作系统',
  },
  twitter: {
    card: 'summary_large_image',
    title: '知渡 - AI 志愿填报与大学生成长平台',
    description: '从高考志愿到人生规划，AI 驱动的个人成长操作系统',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen bg-background text-text-primary antialiased">
        <AuthProvider>
          <ThemeProvider>
            {children}
            <RegisterSW />
            <InstallPrompt />
            <UpdateNotification />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
