# NikahFund — local-first Android PWA

Starter project untuk aplikasi tabungan pernikahan yang menyimpan data transaksi di IndexedDB pada browser/perangkat. Netlify hanya menyajikan file aplikasi; tidak ada backend atau database cloud.

## Fitur

- Dashboard target, progres tabungan, saldo per lokasi.
- Setoran, pengeluaran, dan transfer antar lokasi.
- Transfer tidak mengubah total saldo keseluruhan.
- Log audit lokal untuk pembuatan/penghapusan transaksi, penambahan lokasi, pengaturan, dan restore.
- Backup JSON terenkripsi dengan AES-256-GCM + PBKDF2-SHA-256 (310.000 iterasi).
- Validasi file dan data sebelum restore; restore dilakukan dalam satu transaksi IndexedDB.
- PWA installable dan aset aplikasi dicache untuk akses offline setelah kunjungan awal.
- UI responsif untuk layar Android dan desktop.

## Menjalankan di komputer

Perlu Node.js 20+.

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Folder hasil build adalah `dist/`.

## Deploy ke Netlify

1. Push isi folder project ini ke repository GitHub.
2. Di Netlify, pilih **Add new site → Import an existing project**.
3. Pilih repository tersebut.
4. Build command: `npm run build`.
5. Publish directory: `dist`.
6. Deploy. `netlify.toml` sudah menyetel konfigurasi build dan cache dasar.
7. Buka URL HTTPS Netlify di Chrome Android.
8. Dari menu Chrome, pilih **Tambahkan ke layar utama** atau **Install app**.
9. Buka aplikasi dari ikon yang terpasang. Gunakan URL dan profil Chrome yang sama secara konsisten.

## Cara kerja penyimpanan

- Data transaksi ada di IndexedDB dengan nama database `NikahFundDB`.
- Data terikat ke origin/domain dan profil browser. Mengganti domain, menghapus data situs, menghapus profil Chrome, atau reset perangkat dapat membuat data lokal tidak tersedia.
- Mode incognito tidak direkomendasikan.
- Jangan menghapus data situs/browser sebelum membuat dan menguji backup.
- Backup terenkripsi hanya dapat dibuka dengan kata sandi yang benar. Aplikasi tidak menyimpan kata sandi. Jika lupa, file backup tidak dapat dipulihkan.
- Restore menggantikan seluruh database lokal dengan data dari backup setelah konfirmasi eksplisit.
- Simpan salinan backup di tempat aman lain; backup yang hanya berada di HP yang sama tidak melindungi dari kerusakan atau kehilangan HP.

## Batasan keamanan dan privasi

- Tidak ada request aplikasi untuk mengirim transaksi ke backend/cloud. Jangan menambahkan analytics, session replay, remote logging, atau layanan pihak ketiga tanpa meninjau implikasi privasinya.
- Data IndexedDB **tidak dienkripsi secara terpisah saat tersimpan**. Perlindungan utamanya adalah kunci layar Android, profil perangkat, dan keamanan browser. Hanya file backup yang dienkripsi.
- Orang yang membuka HP dalam keadaan tidak terkunci berpotensi melihat atau mengubah data lokal. Untuk kebutuhan lebih sensitif, tambahkan kunci aplikasi lokal dan kebijakan auto-lock.
- Log audit lokal bukan audit trail anti-manipulasi. Pengguna yang menguasai perangkat/browser dapat mengubah database dan log.
- PWA offline bekerja setelah aplikasi dan service worker berhasil dimuat sekurangnya sekali. Setelah deploy versi baru, buka aplikasi online sesekali agar aset dapat diperbarui.
- Versi starter ini menggunakan `crypto.randomUUID`, Web Crypto, dan IndexedDB; gunakan HTTPS (Netlify menyediakan HTTPS) dan browser Android modern.

## Skema database

- `locations`: tempat penyimpanan dana.
- `transactions`: ledger setoran, pengeluaran, dan transfer; saldo dihitung dari ledger, bukan disimpan sebagai angka terpisah.
- `auditLogs`: catatan perubahan.
- `settings`: target dan preferensi.

Nominal menggunakan integer rupiah untuk menghindari masalah floating point pada nilai uang.
