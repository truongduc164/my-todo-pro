import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Todo Pro - Quản lý công việc hiện đại",
  description: "Dự án Todo App chuyên nghiệp xây dựng bằng Next.js, Supabase, Cloudflare R2, GitHub & Vercel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="scroll-smooth" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="antialiased min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors duration-200"
      >
        {children}
      </body>
    </html>
  );
}
