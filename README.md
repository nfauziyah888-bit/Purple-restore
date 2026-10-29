# 🍇 Purple Store Buyer Finder

Dashboard untuk memantau tweet publik di Twitter/X yang berpotensi dari calon pembeli produk digital Purple Store.
Data diambil lewat **TwitterAPI.io** (endpoint `GET /twitter/tweet/advanced_search`) melalui **Netlify Functions**,
jadi API key kamu tidak pernah ada di browser. Balasan **selalu manual**: tidak ada auto-reply.

## Struktur file

```
purple-store-buyer-finder/
├── index.html                    # halaman utama
├── package.json                  # daftar paket & perintah
├── vite.config.js                # konfigurasi Vite
├── netlify.toml                  # konfigurasi build Netlify
├── .env.example                  # contoh env untuk tes di komputer
├── netlify/functions/search.mjs  # BACKEND: satu-satunya tempat yang memakai TWITTERAPI_KEY
└── src/
    ├── main.jsx                  # pintu masuk React
    ├── App.jsx                   # state, refresh, test koneksi
    ├── lib.js                    # data default, klasifikasi tweet, pembuat query, localStorage
    ├── styles.css                # semua tampilan
    └── components/
        ├── Dashboard.jsx         # statistik, filter, kartu tweet
        ├── Templates.jsx         # kelola template balasan
        └── Settings.jsx          # status API, interval, hashtag/keyword/aplikasi
```

## Menjalankan di komputer

1. Pasang [Node.js](https://nodejs.org) versi 18 atau lebih baru.
2. Di folder proyek: `npm install`
3. **Tanpa API** (hanya melihat tampilan): `npm run dev`, lalu buka alamat yang muncul. Website tetap terbuka, dan akan menampilkan bahwa backend/API belum terhubung. Tidak ada data palsu.
4. **Dengan API** (tes penuh): salin `.env.example` menjadi `.env`, isi `TWITTERAPI_KEY`, lalu jalankan `npx netlify-cli dev` dan buka `http://localhost:8888`.
   File `.env` sudah masuk `.gitignore`, jangan di-upload ke mana pun.

## Deploy ke Netlify

1. Upload proyek ke GitHub (tanpa `node_modules` dan `.env`; sudah diatur di `.gitignore`).
2. Di Netlify: **Add new site → Import an existing project** → pilih repo.
   Pengaturan build terbaca otomatis dari `netlify.toml` (build `npm run build`, publish `dist`, functions `netlify/functions`).
3. Sebelum atau sesudah deploy pertama: **Site configuration → Environment variables → Add a variable**
   - Key: `TWITTERAPI_KEY`
   - Value: API key dari dashboard twitterapi.io
4. **Deploys → Trigger deploy** agar variabel terbaca.
5. Buka situs → **Pengaturan → Test Connection**.

Alternatif tanpa GitHub: `npm run build`, lalu seret folder `dist` ke Netlify. Cara ini **tidak** menjalankan Functions,
jadi untuk versi lengkap pakai cara GitHub atau `npx netlify-cli deploy --prod`.

## Cara kerja pencarian

Satu query dibentuk dari hashtag dan keyword aktif:

```
(#zonauang OR #zonajajan OR #bealanja OR #zonapromosi) ("WTB" OR "Need" OR ...) -filter:retweets since_time:<unix>
```

- `queryType` = `Latest`, pagination memakai `cursor` / `next_cursor` dari API.
- Frontend memanggil `/api/search` satu kali per halaman hasil, dengan **jeda 5,5 detik** antar request
  (akun baru yang belum top up dibatasi 1 request / 5 detik menurut dokumentasi).
- Batas request per refresh bisa diatur (default 2), jadi biaya terkendali.
- Query otomatis dipecah jika terlalu panjang. Query yang dikirim bisa dilihat di Pengaturan.
- Error 401, 402 (kredit habis), 403, 429, dan 400 ditampilkan dengan pesan jelas. Hanya error 429 yang diulang, itu pun **sekali**. Kredit habis (402) langsung berhenti.

## Label calon pembeli

| Label | Syarat |
|---|---|
| Potensi pembeli | Ada keyword niat beli **dan** nama aplikasi, tanpa kata penjual |
| Perlu diperiksa | Hanya sebagian sinyal (mis. keyword tanpa aplikasi, atau aplikasi tanpa keyword) |
| Kemungkinan promosi seller | Ada kata `open`, `ready stock`, `jual`, `pricelist`, `open order` |

Tweet berlabel seller **tidak dihapus**, hanya ditandai. Alasan label tampil di tiap kartu.
Daftar kata penjual ada di `SELLER_WORDS` dan nama lain aplikasi di `ALIASES`, keduanya di `src/lib.js`.

## Hal yang perlu kamu tahu (jujur)

- **localStorage** hanya menyimpan data di browser dan perangkat yang dipakai. Tidak ada sinkronisasi antar HP/laptop.
  Menghapus data browser menghapus semuanya. Maksimal 1.000 tweet disimpan.
- **Refresh otomatis default mati** agar kredit tidak terpakai diam-diam. Jika dinyalakan (default 30 menit), ia hanya jalan saat halaman terbuka.
- **Hapus dari dashboard** hanya menghapus dari dashboard ini. Tweet asli di Twitter/X tidak terhapus. ID tweet yang dihapus diingat agar tidak muncul lagi.
- **Balas Pakai Template** membuka jendela balasan X dengan teks terisi dan menyalin teks ke clipboard. Kamu tetap menekan kirim sendiri.
  Jika X tidak mengisi teks otomatis, tempel dari clipboard.
- **Nama aplikasi** dideteksi dari kata di isi tweet. Field "source" API bukan nama aplikasi produk dan sering kosong, jadi tidak dipakai.
- **Biaya**: dokumentasi TwitterAPI.io menyebut tarif sekitar $0.15 per 1.000 tweet dan ada akun gratis/trial, tetapi tarif dan paket bisa berubah.
  Cek paketmu di dashboard twitterapi.io. Sisa kredit tidak bisa ditampilkan di aplikasi ini; lihat di dashboard mereka.
- Pencarian bergantung pada hasil X/TwitterAPI.io. Tweet tidak dijamin lengkap, dan akun privat tidak muncul.

## Tahap berikutnya: Supabase (opsional)

Untuk berbagi data antar perangkat, simpan `tweets`, `templates`, dan pengaturan di tabel Supabase (gratis untuk skala kecil, cek ketentuan terbaru).
Ganti `useLocal(...)` di `App.jsx` dengan pemanggilan Supabase. Versi pertama ini sengaja tidak memerlukannya.
