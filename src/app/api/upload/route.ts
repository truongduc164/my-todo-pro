import { NextRequest, NextResponse } from "next/server";
import { isR2Configured, uploadToR2 } from "@/lib/cloudflare/r2";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const getSupabase = () => {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://pobgsdhzttmpkhrohobw.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "sb_publishable_r_GMW6oVxI4mlEIrsJtcWg_kAdMhm5G";
  if (!url || !key || !url.startsWith("http")) return null;
  return createClient(url, key);
};

export async function GET() {
  const r2 = isR2Configured();
  const supabase = Boolean(getSupabase());

  let activeProvider = "demo";
  if (r2) activeProvider = "cloudflare_r2";
  else if (supabase) activeProvider = "supabase_storage";

  return NextResponse.json({
    isR2Configured: r2,
    isSupabaseConfigured: supabase,
    activeProvider,
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Không tìm thấy file tải lên" }, { status: 400 });
    }

    // Kiểm tra định dạng file an toàn (Whitelist MIME types)
    if (!file.type || !ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Định dạng không hợp lệ. Chỉ chấp nhận ảnh JPG, PNG, WebP, GIF." },
        { status: 400 }
      );
    }

    // Giới hạn kích thước ảnh tối đa 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Dung lượng ảnh tối đa là 5MB." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 1. Ưu tiên Cloudflare R2 nếu đã cấu hình
    if (isR2Configured()) {
      const safeName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_{2,}/g, "_")
        .slice(0, 100);

      const imageUrl = await uploadToR2(buffer, safeName, file.type);
      return NextResponse.json({ url: imageUrl, provider: "cloudflare_r2" });
    }

    // 2. Sử dụng Supabase Storage (100% Free, không cần thẻ tín dụng)
    const supabase = getSupabase();
    if (supabase) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `todos/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("todo-images")
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Lỗi Supabase storage upload:", uploadError);
        // Nếu bucket chưa được tạo hoặc chưa cấp quyền, báo lỗi rõ ràng
        return NextResponse.json(
          { error: `Lỗi Supabase Storage: ${uploadError.message}. Hãy chạy file supabase_schema.sql trong SQL Editor để tự động tạo bucket 'todo-images'.` },
          { status: 500 }
        );
      }

      const { data: publicUrlData } = supabase.storage
        .from("todo-images")
        .getPublicUrl(filePath);

      return NextResponse.json({
        url: publicUrlData.publicUrl,
        provider: "supabase_storage",
      });
    }

    // 3. Chế độ Demo lưu tạm trình duyệt (khi chưa có Supabase lẫn Cloudflare)
    if (file.size > 500 * 1024) {
      return NextResponse.json(
        {
          error: "Ở chế độ Demo, ảnh giới hạn tối đa 500KB để tránh tràn bộ nhớ trình duyệt. Kết nối Supabase để tải ảnh đến 5MB."
        },
        { status: 400 }
      );
    }

    const base64 = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;
    return NextResponse.json({
      url: dataUrl,
      provider: "demo_local",
      notice: "Đang chạy chế độ Demo (ảnh lưu dạng base64). Kết nối Supabase để lưu ảnh tự động vào Supabase Storage."
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Lỗi khi tải ảnh lên" }, { status: 500 });
  }
}
