import { NextRequest, NextResponse } from "next/server";
import { isR2Configured, uploadToR2 } from "@/lib/cloudflare/r2";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function GET() {
  return NextResponse.json({ isR2Configured: isR2Configured() });
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

    if (isR2Configured()) {
      // Đã cấu hình Cloudflare R2 -> Sanitize tên file và Upload lên R2
      const safeName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_{2,}/g, "_")
        .slice(0, 100);

      const imageUrl = await uploadToR2(buffer, safeName, file.type);
      return NextResponse.json({ url: imageUrl, provider: "cloudflare_r2" });
    } else {
      // Chưa cấu hình Cloudflare R2 -> Chế độ Demo
      // Giới hạn 500KB cho base64 demo để tránh làm tràn quota 5MB của localStorage trình duyệt
      if (file.size > 500 * 1024) {
        return NextResponse.json(
          {
            error: "Ở chế độ Demo (lưu trên trình duyệt), ảnh giới hạn tối đa 500KB để tránh tràn bộ nhớ. Cấu hình Cloudflare R2 để tải ảnh đến 5MB."
          },
          { status: 400 }
        );
      }

      const base64 = buffer.toString("base64");
      const dataUrl = `data:${file.type};base64,${base64}`;
      return NextResponse.json({
        url: dataUrl,
        provider: "demo_local",
        notice: "Đang chạy chế độ Demo (ảnh lưu dạng base64). Điền thông tin R2 trong .env.local để lưu trực tiếp vào Cloudflare R2."
      });
    }
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Lỗi khi tải ảnh lên" }, { status: 500 });
  }
}
