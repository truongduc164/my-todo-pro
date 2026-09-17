import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://pobgsdhzttmpkhrohobw.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "sb_publishable_r_GMW6oVxI4mlEIrsJtcWg_kAdMhm5G";

  try {
    const supabase = createClient(url, key);
    // Truy vấn nhẹ 1 bản ghi để kích hoạt Database không bị Supabase cho ngủ đông
    const { data, error } = await supabase.from("todos").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        {
          status: "warning",
          message: "Watchdog đã ping nhưng Supabase báo lỗi",
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "alive",
      message: "Watchdog hoạt động thành công! Web Vercel & Supabase Database luôn thức 24/7.",
      timestamp: new Date().toISOString(),
      supabaseActive: true,
      checkedAt: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        error: err.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
