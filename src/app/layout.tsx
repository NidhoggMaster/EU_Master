import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "EU Master Application Manager",
    template: "%s · EU Master",
  },
  description:
    "面向欧洲硕士项目的申请规划与材料管理工作台，首期开放荷兰。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
