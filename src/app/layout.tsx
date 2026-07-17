import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  return {
    metadataBase,
    title: { default: "EU Master Application Manager", template: "%s · EU Master" },
    description: "面向欧洲硕士项目的本地申请规划、项目、材料与进度管理工作台。",
    openGraph: {
      title: "EU Master · 欧洲硕士申请管理",
      description: "荷兰硕士项目、材料、任务与申请进度，本地集中管理。",
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "EU Master 欧洲硕士申请管理" }],
    },
    twitter: { card: "summary_large_image", images: ["/og.png"] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
