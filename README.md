# AEROWAVE

Ứng dụng desktop Windows chạy local dùng để tải nhạc từ YouTube (video đơn & playlist) với giao diện **Rainmeter / Atmospheric HUD** hiện đại.

## Tính năng nổi bật

- **Giao diện Atmospheric HUD:** Cửa sổ frameless trong suốt/kính mờ, đồng hồ thời gian thực siêu mảnh, hình nền hoàng hôn tích hợp sẵn tự chuyển cảnh mượt (crossfade) sang ảnh bìa bài hát hoặc ảnh nền tùy chọn.
- **Radial HUD & Circular Arc Dock:** Cụm 3 vòng đồng tâm SVG hiển thị tiến trình tải (`0–100%`), tốc độ tải và trạng thái xử lý `FFmpeg`/Metadata; vòng cung nút thao tác nhanh bên cạnh.
- **Audio Visualizer thời gian thực:** Dải cột xanh dương phát sáng vẽ bằng HTML5 Canvas 60fps nối Web Audio API (`AnalyserNode`), phát nhạc local qua custom protocol `aerowave-media://` (hỗ trợ HTTP `Range` để tua mượt) mà vẫn giữ `webSecurity: true`.
- **Hỗ trợ đa định dạng & Metadata:** `MP3` (320kbps), `FLAC` (Lossless), `M4A` (âm thanh gốc), `WAV`; tự động nhúng ảnh bìa vuông & ID3 tags (`--embed-thumbnail`, `--add-metadata`).
- **Telemetry & Quản lý hàng đợi:** Theo dõi trạng thái `yt-dlp`, `FFmpeg`, dung lượng ổ đĩa chứa thư mục lưu nhạc, và bảng Hàng đợi/Lịch sử hỗ trợ nghe thử, mở vị trí file, thử lại hoặc hủy sạch process cây trên Windows.

## Stack công nghệ

- **Desktop Shell:** Electron + `electron-builder` (Windows x64 `dir` target)
- **Frontend:** React + TypeScript + Vite + Tailwind CSS + Lucide Icons + HTML5 Canvas
- **Media CLI (local PATH):** `yt-dlp` & `ffmpeg`

## Yêu cầu hệ thống (Windows)

Cài sẵn `yt-dlp` và `ffmpeg` trong `PATH` hệ thống:

```powershell
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

## Cài đặt & Đóng gói

```powershell
# Cài đặt dependencies
npm install

# Kiểm tra TypeScript (Frontend & Electron)
npm run typecheck

# Biên dịch sản phẩm (dist/ & dist-electron/)
npm run build

# Chạy ứng dụng từ bản build
npm start

# Đóng gói ra release/win-unpacked/AEROWAVE.exe
npm run dist
```

## Cấu trúc thư mục

```text
├── build/                 # Icon ứng dụng
├── electron/              # Electron Main Process, Preload, IPC, Protocol & yt-dlp Runner
├── public/                # Hình nền mặc định local
├── shared/                # TypeScript interfaces dùng chung giữa Main & Renderer
├── src/                   # Giao diện React + Tailwind + Canvas Audio Visualizer
├── package.json
├── tsconfig.json
├── tsconfig.electron.json
└── vite.config.ts
```

## Giấy phép

Phát hành theo giấy phép [MIT](LICENSE).
