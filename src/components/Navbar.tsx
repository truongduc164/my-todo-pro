"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Moon, Sun, LogIn, LogOut, Database, Cloud } from "lucide-react";

interface NavbarProps {
  userEmail?: string | null;
  isSupabaseConfigured?: boolean;
  storageProvider?: "cloudflare_r2" | "supabase_storage" | "demo";
  onLogout?: () => void;
}

export default function Navbar({
  userEmail,
  isSupabaseConfigured = false,
  storageProvider = "demo",
  onLogout,
}: NavbarProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial dark mode from localStorage or document
    const isDarkMode =
      localStorage.getItem("theme") === "dark" ||
      (!("theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    setIsDark(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
              My Todo Pro
            </span>
            <span className="block text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
              Supabase • Cloudflare • Vercel
            </span>
          </div>
        </Link>

        {/* Integration Status Badges */}
        <div className="hidden md:flex items-center gap-2 text-xs">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
              userEmail
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60"
                : isSupabaseConfigured
                ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            }`}
            title={
              userEmail
                ? `Đã kết nối tài khoản: ${userEmail}`
                : isSupabaseConfigured
                ? "Database đã kết nối! Hãy bấm Đăng nhập để đồng bộ công việc."
                : "Chế độ lưu tạm trình duyệt (chưa có key Supabase)"
            }
          >
            <Database className="w-3.5 h-3.5" />
            <span>
              Supabase:{" "}
              {userEmail
                ? "Live"
                : isSupabaseConfigured
                ? "Sẵn sàng (Chưa đăng nhập)"
                : "Local Demo"}
            </span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
              storageProvider === "cloudflare_r2"
                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60"
                : storageProvider === "supabase_storage"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            }`}
            title={
              storageProvider === "cloudflare_r2"
                ? "Lưu trữ qua Cloudflare R2"
                : storageProvider === "supabase_storage"
                ? "Lưu trữ qua Supabase Storage (100% Miễn phí, không cần thẻ)"
                : "Chế độ ảnh demo (lưu tạm trình duyệt)"
            }
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>
              Kho ảnh:{" "}
              {storageProvider === "cloudflare_r2"
                ? "Cloudflare R2"
                : storageProvider === "supabase_storage"
                ? "Supabase Storage"
                : "Demo"}
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User Auth Info */}
          {userEmail ? (
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:block text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Đăng nhập với</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[140px] truncate">
                  {userEmail}
                </p>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900/60 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/30 transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
