# My Todo Pro - Fullstack Web Application
> **Stack công nghệ chuẩn Production:** Next.js 15 (App Router) + Supabase (PostgreSQL/Auth) + Cloudflare R2 (Storage S3) + GitHub + Vercel.

Dự án này được thiết kế để bạn thực tập và làm chủ toàn bộ quy trình xây dựng, cấu hình và triển khai một ứng dụng web thực tế từ máy cá nhân lên internet.

---

## 🌟 Các tính năng nổi bật

- **Frontend Hiện Đại**: Giao diện Responsive (Điện thoại, Tablet, Desktop) bằng Next.js 15, Tailwind CSS, Lucide Icons, hỗ trợ chế độ **Dark / Light mode**.
- **Quản lý công việc thông minh**:
  - Phân loại theo 3 mức ưu tiên: **Thấp 🍃**, **Trung bình ⚡**, **Cao 🔥** (kế thừa từ logic CLI `main.py`).
  - Phân loại trạng thái: **Cần làm**, **Đang làm**, **Hoàn thành**.
  - Tìm kiếm tức thì theo từ khóa và lọc đa điều kiện.
  - Hạn chót (Due date) kèm cảnh báo quá hạn.
- **Lưu trữ hình ảnh Cloudflare R2**: Tải ảnh đính kèm công việc (bằng chứng hoàn thành, ảnh ghi chú) lưu thẳng lên Cloudflare R2 (chuẩn S3) với chi phí băng thông 0đ.
- **Cơ sở dữ liệu & Xác thực Supabase**:
  - Lưu trữ trên PostgreSQL Cloud.
  - Hệ thống Đăng nhập / Đăng ký an toàn (Supabase Auth).
  - Bảo mật dữ liệu bằng **Row Level Security (RLS)** (mỗi người dùng chỉ quản lý được công việc của mình).
  - Tự động cập nhật dữ liệu tức thì (**Supabase Realtime**).
- **Chế độ Thực hành linh hoạt (Demo Mode)**: Có thể chạy và dùng ngay trên trình duyệt thông qua LocalStorage ngay cả khi chưa kịp cấu hình key Supabase/Cloudflare.

---

## 🚀 Hướng dẫn chạy thử trên máy cục bộ (Local Development)

### 1. Cài đặt các thư viện cần thiết
Mở Terminal tại thư mục dự án và chạy:
```bash
npm install
```

### 2. Chạy môi trường phát triển
```bash
npm run dev
```
Sau đó mở trình duyệt và truy cập: [http://localhost:3000](http://localhost:3000).

---

## 📋 Hướng dẫn chi tiết 4 bước thực hành

### Bước 1: Thiết lập Database & Auth trên Supabase
1. Truy cập [https://supabase.com](https://supabase.com) và đăng nhập bằng tài khoản GitHub.
2. Nhấn **New Project**, đặt tên (vd: `my-todo-app`), chọn mật khẩu database và vị trí khu vực (khuyên chọn *Singapore* để tốc độ nhanh nhất tại Việt Nam).
3. Sau khi dự án khởi tạo xong (khoảng 1-2 phút):
   - Nhấn vào biểu tượng **SQL Editor** ở thanh bên trái.
   - Mở file `supabase_schema.sql` trong dự án này, copy toàn bộ nội dung dán vào SQL Editor trên Supabase.
   - Nhấn nút **Run** để tạo bảng `todos` và các chính sách bảo mật RLS.
4. Lấy khóa API:
   - Vào **Project Settings** (biểu tượng bánh răng ở dưới cùng thanh bên trái) -> chọn **API**.
   - Copy **Project URL** và **anon public key**.
   - Mở file `.env.local` trong dự án và điền vào:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=https://your-id.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
     ```

---

### Bước 2: Thiết lập Cloudflare R2 (Lưu trữ ảnh đính kèm)
1. Truy cập [Cloudflare Dashboard](https://dash.cloudflare.com) và đăng nhập.
2. Tại menu bên trái, chọn **R2 Storage**:
   - Nhấn **Create bucket**, đặt tên là `my-todo-images` (chọn khu vực Automatic hoặc APAC).
3. Bật truy cập công khai (Public Access) để xem được ảnh:
   - Trong Bucket vừa tạo, chọn tab **Settings**.
   - Tại mục **Public Development URL** (hoặc Custom Domain), bấm **Allow Access** (hoặc Connect Domain).
   - Copy đường dẫn public URL (ví dụ: `https://pub-xxxxxx.r2.dev`).
4. Lấy API Token (S3 Credentials):
   - Quay lại trang tổng quan R2 Storage -> chọn **Manage R2 API Tokens** ở bên phải.
   - Bấm **Create API token**, chọn quyền **Object Read & Write**, thời hạn tùy chọn.
   - Bấm **Create API Token**, bạn sẽ nhận được:
     - **Access Key ID**
     - **Secret Access Key**
     - **Account ID** (nằm ở URL hoặc trang R2 Overview).
5. Mở file `.env.local` và điền:
   ```env
   R2_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxx
   R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxx
   R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxx
   R2_BUCKET_NAME=my-todo-images
   NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-xxxxxx.r2.dev
   ```

---

### Bước 3: Đưa mã nguồn lên GitHub
1. Mở Terminal tại thư mục dự án này, kiểm tra và commit code:
   ```bash
   git init
   git add .
   git commit -m "feat: complete modern todo app with next.js, supabase and cloudflare r2"
   ```
2. Truy cập [https://github.com](https://github.com), đăng nhập và bấm **New repository** (đặt tên vd: `my-todo-pro`, để Public hoặc Private tùy ý).
3. Đẩy code lên GitHub bằng các lệnh mà GitHub hiển thị:
   ```bash
   git branch -M main
   git remote add origin https://github.com/TÊN_TÀI_KHOẢN_CỦA_BẠN/my-todo-pro.git
   git push -u origin main
   ```

---

### Bước 4: Triển khai (Deploy) lên Vercel
1. Truy cập [https://vercel.com](https://vercel.com) và chọn **Sign in with GitHub**.
2. Tại trang Dashboard của Vercel, nhấn nút **Add New...** -> chọn **Project**.
3. Danh sách repo GitHub của bạn sẽ hiện ra, tìm repo `my-todo-pro` và nhấn **Import**.
4. Cấu hình biến môi trường (Environment Variables):
   - Mở rộng mục **Environment Variables**.
   - Copy toàn bộ nội dung từ file `.env.local` dán vào (Vercel hỗ trợ paste trực tiếp toàn bộ chuỗi key=value).
5. Nhấn **Deploy**.
6. Vercel sẽ tự động tải dependencies, biên dịch TypeScript và cấp cho bạn một domain HTTPS miễn phí toàn cầu (ví dụ: `https://my-todo-pro-xxxx.vercel.app`)!

Mỗi lần bạn chỉnh sửa code và chạy `git push`, Vercel sẽ tự động build và cập nhật phiên bản mới nhất lên web mà bạn không cần thao tác gì thêm (chuẩn CI/CD).

---

## 📁 Cấu trúc thư mục dự án

```
├── src/
│   ├── app/
│   │   ├── api/upload/route.ts   # API xử lý upload ảnh lên Cloudflare R2
│   │   ├── login/page.tsx        # Giao diện Đăng nhập / Đăng ký (Supabase Auth)
│   │   ├── globals.css           # Cấu hình Tailwind CSS & Custom Themes
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Dashboard chính (Kanban, Stats, Realtime, Filter)
│   ├── components/
│   │   ├── Navbar.tsx            # Header hiển thị trạng thái Supabase / R2 / Auth
│   │   ├── StatsBar.tsx          # Thống kê tổng hợp số lượng công việc
│   │   ├── TodoCard.tsx          # Card hiển thị công việc & ảnh đính kèm
│   │   ├── TodoFilter.tsx        # Tìm kiếm, lọc ưu tiên và trạng thái
│   │   └── TodoModal.tsx         # Popup tạo/sửa việc và chọn ảnh
│   └── lib/
│       ├── cloudflare/r2.ts      # Kết nối Cloudflare R2 qua AWS S3 Client
│       ├── supabase/client.ts    # Supabase Client kết nối Database & Auth
│       ├── types.ts              # TypeScript interfaces
│       └── utils.ts              # Hàm tiện ích định dạng ngày giờ, màu sắc
├── .env.example                  # File mẫu biến môi trường
├── .env.local                    # Biến môi trường trên máy của bạn
├── .gitignore                    # Bỏ qua node_modules, key bí mật
├── main.py                       # CLI Todo Python gốc (được bảo tồn nguyên vẹn)
├── package.json                  # Khai báo thư viện & kịch bản build
├── supabase_schema.sql           # Script khởi tạo Database cho Supabase SQL Editor
├── tailwind.config.ts            # Cấu hình giao diện Tailwind
└── tsconfig.json                 # Cấu hình TypeScript
```
