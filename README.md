# GitHub Pages ArtPinner

ArtPinner - web portfolio cá nhân dùng React + Vite, deploy lên GitHub Pages, dữ liệu và ảnh lưu trên Supabase.

## Chức năng

- Gallery artwork giao diện tối, dạng card/masonry.
- Show hình ảnh từ server.
- Filter artwork theo tag.
- Trang About có avatar, bio, liên hệ, social links.
- Trang Chỉnh sửa để sửa profile/avatar, trang Đăng ảnh riêng để upload artwork.
- Deploy bằng GitHub Actions theo đúng form GitHub Pages.

## Cấu trúc project

```txt
.
├── .github/workflows/pages.yml
├── index.html
├── package.json
├── vite.config.js
├── src
│   ├── App.jsx
│   ├── main.jsx
│   ├── styles.css
│   ├── data/fallback.js
│   └── lib/supabaseClient.js
├── supabase/schema.sql
└── .env.example
```

## 1. Chạy local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Nếu chưa điền Supabase env, web vẫn chạy demo bằng dữ liệu fallback.

## 2. Tạo Supabase project miễn phí

1. Vào Supabase và tạo project mới.
2. Mở SQL Editor.
3. Copy toàn bộ nội dung `supabase/schema.sql` và Run.
4. Vào Authentication > Users > Add user để tạo tài khoản admin.
5. Vào Project Settings > API, copy:
   - Project URL
   - anon public key
6. Điền vào `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_STORAGE_BUCKET=portfolio-images
```

## 3. Deploy lên GitHub Pages

### Cách đặt repo

Bạn có 2 lựa chọn:

- Repo dạng user site: `username.github.io` → web chạy tại domain gốc.
- Repo dạng project site: ví dụ `portfolio` → web chạy tại `https://username.github.io/portfolio/`.

Project này dùng `base: "./"` trong `vite.config.js`, nên cả 2 cách đều chạy được.

### Push code

```bash
git init
git add .
git commit -m "Initial portfolio"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git push -u origin main
```

### Thêm GitHub Secrets

Vào GitHub repo > Settings > Secrets and variables > Actions > New repository secret:

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

`VITE_STORAGE_BUCKET` đang được đặt sẵn trong workflow là `portfolio-images`.

### Bật Pages

Vào GitHub repo > Settings > Pages > Build and deployment > Source > chọn **GitHub Actions**.

Sau khi push lên `main`, workflow `.github/workflows/pages.yml` sẽ tự build và deploy thư mục `dist`.

## 4. Dùng trang Admin

Mở web sau khi deploy:

```txt
https://USERNAME.github.io/REPO_NAME/#/edit
https://USERNAME.github.io/REPO_NAME/#/upload
```

Đăng nhập bằng user bạn tạo trong Supabase Authentication.

## 5. Lưu ý bảo mật

- `VITE_SUPABASE_ANON_KEY` là public key, có thể nằm trong frontend.
- Quyền sửa/xóa chỉ cho user đã đăng nhập nhờ Row Level Security trong `supabase/schema.sql`.
- Đừng tắt RLS nếu web được public.
- Với portfolio cá nhân, nên chỉ tạo 1 tài khoản admin cho bạn.


## Route mới

```txt
#/                 Gallery có tìm kiếm theo tiêu đề, tag, tên người
#/user             Trang thông tin người dùng + artwork
#/about            Thông tin cá nhân
#/upload           Đăng ảnh mới
#/edit             Chỉnh sửa profile và quản lý ảnh
#/art/<id>         Xem chi tiết từng ảnh
```
