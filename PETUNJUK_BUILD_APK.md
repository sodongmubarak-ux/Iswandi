# PANDUAN LENGKAP BUILD APK DI GITHUB (KHUSUS PENGGUNA HP ANDROID TANPA PC)

Aplikasi **CATATAN BY ISWANDI** telah disiapkan dengan sistem otomatis **GitHub Actions Cloud Build** (`.github/workflows/build-apk.yml`). Anda **TIDAK MEMERLUKAN KOMPUTER/PC** sama sekali! Seluruh proses kompilasi Java, Android SDK, Gradle, dan pembuatan file APK dilakukan di server cloud milik GitHub secara gratis, dan file APK bisa langsung diunduh ke HP Android Anda.

---

## 🚀 METODE UTAMA: BUILD APK OTOMATIS LEWAT BROWSER HP ANDROID (GRATIS & CEPAT)

### Langkah 1: Unduh Berkas Proyek di HP Anda
1. Buka aplikasi ini di browser HP Anda.
2. Masuk ke menu **Pengaturan** (ikon gerigi).
3. Gulir ke bagian **"Ekspor & Build APK Android"**.
4. Ketuk tombol emas: **"UNDUH KODE PROYEK LENGKAP (.ZIP)"**.
5. File `catatan-by-iswandi-source.zip` akan tersimpan di folder Download HP Anda.

---

### Langkah 2: Buat Repositori di GitHub lewat Browser HP
1. Buka browser (Google Chrome) di HP Anda, buka [https://github.com](https://github.com).
2. Masuk (Login) ke akun GitHub Anda, atau Daftar jika belum memiliki akun (100% gratis).
3. Ketuk ikon foto profil atau tombol **"+"** di kanan atas > pilih **New repository**.
4. Beri nama repositori, contoh: `catatan-iswandi`.
5. Pilih **Public**.
6. Ketuk tombol hijau **Create repository**.

---

### Langkah 3: Unggah Berkas ke GitHub
Ada 2 cara mudah mengunggah berkas lewat HP:

#### Cara A (Lewat Fitur Upload Browser HP):
1. Di halaman repositori baru yang baru dibuat, ketuk link bertuliskan: **"uploading an existing file"**.
2. Ekstrak file zip di HP Anda (menggunakan File Manager bawaan HP / ZArchiver).
3. Pilih dan unggah semua file & folder ke GitHub (termasuk folder `.github`, `android`, `src`, `public`, `package.json`, `capacitor.config.json`, dll).
4. Gulir ke bawah dan ketuk tombol hijau **Commit changes**.

#### Cara B (Alternatif Aplikasi GitHub Mobile / Termux / Acode di Android):
Jika Anda menggunakan aplikasi editor Android seperti **Acode** atau terminal **Termux**, Anda dapat langsung melakukan `git push` ke repositori GitHub Anda.

---

### Langkah 4: Jalankan Build APK Otomatis
1. Di halaman repositori GitHub Anda, ketuk menu **Actions** (ikon lingkaran panah/play).
2. Di sebelah kiri atau dalam daftar, pilih workflow: **"Build Android APK (Catatan by Iswandi)"**.
3. Ketuk tombol **"Run workflow"** > pilih branch `main` (atau `master`) > ketuk tombol hijau **"Run workflow"**.
4. Sistem cloud GitHub akan otomatis menjalankan:
   - Setup Node.js & dependencies
   - Setup Java 17 & Android SDK
   - Build Web Application & Capacitor Sync
   - Kompilasi Gradle: `./gradlew assembleDebug`
   - Pembuatan file APK: `Catatan-by-Iswandi.apk`

---

### Langkah 5: Unduh & Pasang APK Langsung di HP Android Anda
1. Tunggu sekitar 2 - 3 menit hingga muncul tanda centang hijau (✔) bertuliskan **Build & Package APK**.
2. Ketuk judul workflow yang selesai tersebut.
3. Gulir ke bawah ke bagian **Artifacts**:
   - Ketuk berkas **`Catatan-by-Iswandi-APK`** untuk langsung mengunduh ke HP Anda!
4. ATAU buka menu **Releases** di GitHub:
   - File `Catatan-by-Iswandi.apk` tersedia untuk diunduh langsung sekali klik tanpa perlu unzip.
5. Setelah terunduh, ketuk file APK di HP Anda untuk memasangnya.
6. Jika Android menampilkan peringatan "Instal aplikasi dari sumber tidak dikenal", pilih **Izinkan/Allow**.
7. Aplikasi Catatan Iswandi berhasil terpasang di HP Anda dan siap digunakan 100% offline!

---

## ⚡ METODE ALTERNATIF: INSTALASI INSTAN PWA DI HP ANDROID (DALAM 5 DETIK, TANPA BUILD)

Jika Anda ingin langsung menggunakan aplikasi di HP tanpa harus menunggu build GitHub:
1. Buka URL aplikasi ini di **Google Chrome** pada HP Android Anda.
2. Ketuk tombol emas **"Pasang APK/App"** di bilah atas aplikasi, ATAU ketuk menu titik tiga (⋮) di pojok kanan atas Chrome, lalu pilih:
   **"Tambahkan ke Layar Utama" (Add to Home screen)** atau **"Instal Aplikasi"**.
3. Aplikasi akan langsung terpasang di layar utama HP Anda dengan ikon Catatan Iswandi, terbuka fullscreen tanpa bilah browser, dan data tersimpan aman di HP secara offline!

---

## 💻 METODE PENGEMBANG (JIKA MENGGUNAKAN PC / LAPTOP)
Jika sewaktu-waktu Anda menggunakan PC:
```bash
npm install --legacy-peer-deps
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```
File APK debug berada di: `android/app/build/outputs/apk/debug/app-debug.apk`.
