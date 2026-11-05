# ECG Telemetry Dashboard

Aplikasi web untuk memantau perangkat ECG secara realtime. Dashboard menerima telemetri melalui MQTT, menampilkan sinyal ECG tiga lead, dan memakai Firebase Authentication serta Realtime Database untuk autentikasi, data perangkat, assignment pasien, dan rekaman.

## Fitur

- Login dengan Firebase Authentication.
- Ringkasan status perangkat, koneksi MQTT, BPM, dan aktivitas terakhir.
- Pemantauan sinyal ECG Lead I, II, dan III secara realtime.
- Pengaturan tampilan grafik, termasuk rentang waktu, sensitivitas, grid, dan lead yang ditampilkan.
- Assignment informasi pasien ke perangkat.
- Mulai dan hentikan rekaman ECG, simpan snapshot, lihat riwayat, unduh, dan hapus rekaman sesuai hak akses.
- Manajemen user dan role `master`, `doctor`, serta `nurse`.
- Logout otomatis setelah 15 menit tidak aktif selama tidak ada rekaman berjalan.
- Tema terang dan gelap.

## Teknologi

- Next.js App Router, React, dan TypeScript
- Tailwind CSS
- Firebase Authentication dan Realtime Database
- Firebase Admin SDK untuk API pengelolaan user
- MQTT over WebSocket (`mqtt`)
- uPlot untuk visualisasi sinyal

## Persyaratan

- Node.js yang mendukung Next.js 16
- npm
- Project Firebase dengan Email/Password Authentication dan Realtime Database aktif
- Broker MQTT yang dapat diakses melalui WebSocket Secure (WSS)

## Menjalankan secara lokal

1. Pasang dependency:

   ```bash
   npm install
   ```

2. Buat file `.env.local` di root project dan isi konfigurasi pada bagian berikut.

3. Jalankan server development:

   ```bash
   npm run dev
   ```

4. Buka [http://localhost:3000](http://localhost:3000).

Perintah lain yang tersedia:

```bash
npm run lint
npm run build
npm run start
```

## Konfigurasi environment

Isi `.env.local` dengan nilai dari Firebase Console, kredensial Firebase Admin, dan broker MQTT:

```dotenv
# Firebase Web SDK — berasal dari konfigurasi aplikasi web Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_FIREBASE_DB_URL=

# Firebase Admin SDK — service account, hanya untuk server
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=

# MQTT — broker harus menyediakan endpoint WebSocket/WSS
NEXT_PUBLIC_MQTT_BROKER_URL=
NEXT_PUBLIC_MQTT_USERNAME=
NEXT_PUBLIC_MQTT_PASSWORD=
```

Variabel `NEXT_PUBLIC_*` tersedia di sisi browser. Jangan masukkan private key atau kredensial rahasia server ke variabel dengan awalan tersebut. `FIREBASE_PRIVATE_KEY` perlu menyimpan baris baru sebagai `\n`; aplikasi mengubahnya kembali saat inisialisasi Firebase Admin.

## MQTT

Untuk pesan ECG, segmen `+` adalah ID perangkat. Payload JSON menerima field:

```json
{
  "deviceId": "device-01",
  "startMillis": 1730000000000,
  "sampleIntervalMs": 4,
  "sampleRateHz": 250,
  "lead1": [0.12, 0.18, 0.09],
  "lead2": [0.08, 0.11, 0.07],
  "lead3": [-0.04, 0.02, 0.01],
  "bpm": 72,
  "chunkSeq": 1
}
```

`startMillis` dapat diganti dengan `timestamp`. Interval sampel dapat diberikan sebagai `sampleIntervalMs`, `intervalMs`, atau `interval`; jika tidak tersedia, aplikasi memakai nilai default dari `constants/ecg.ts`. `deviceId` pada payload bersifat opsional karena ID juga dapat diambil dari topik.

Pesan status memakai topik `ECG_TA/devices/{deviceId}/status` dan dapat menyertakan `online`, `sampleRateHz`, `uptimeSeconds`, `streaming`, serta `lastSeen`.

Perintah reset perangkat dipublikasikan oleh dashboard ke `devices/{deviceId}/commands` dengan payload:

```json
{
  "command": "reset",
  "requestedAt": 1730000000000
}
```

Pastikan perangkat dan ACL broker mendukung topik serta format tersebut. URL broker dapat diubah lewat `NEXT_PUBLIC_MQTT_BROKER_URL`.

## Firebase dan hak akses

1. Buat project Firebase dan aplikasi web, lalu aktifkan Email/Password pada Authentication.
2. Aktifkan Realtime Database dan masukkan URL database pada `NEXT_PUBLIC_FIREBASE_DB_URL` serta `FIREBASE_DATABASE_URL`.
3. Siapkan service account untuk server API dan isi variabel Firebase Admin. Private key hanya digunakan di server.
4. Buat akun pengguna melalui Firebase Authentication dan siapkan profil role di Realtime Database pada `users/{uid}`. Aplikasi memakai role `master`, `doctor`, dan `nurse`; profil nonaktif (`status: "inactive"`) tidak dapat membuat user melalui API.
5. Atur Firebase Database Rules agar hanya pengguna terautentikasi dan berwenang dapat membaca atau menulis data. Pemeriksaan izin di UI bukan pengganti aturan keamanan database.

API `POST /api/users` memverifikasi Firebase ID token dan mengizinkan pembuatan user hanya untuk pengguna dengan role `master` yang aktif.

## Halaman aplikasi

| Path | Fungsi |
| --- | --- |
| `/` | Login |
| `/dashboard` | Ringkasan perangkat dan status realtime |
| `/devices` | Daftar perangkat; pilih perangkat untuk membuka monitor ECG |
| `/devices?key={deviceId}` | Monitor sinyal dan kontrol rekaman perangkat |
| `/users` | Manajemen user untuk role yang berwenang |
| `/reports` | Riwayat dan pengelolaan rekaman sesuai hak akses |
| `/patients` | Mengarahkan pengguna ke halaman perangkat |

## Struktur data utama

Realtime Database menggunakan node berikut:

```text
users/{uid}
devices/{deviceId}
records/{recordId}
```

Data perangkat menyimpan telemetri dan assignment pasien. Status rekaman berjalan disimpan pada `devices/{deviceId}`. Metadata dan chunk sinyal rekaman disimpan pada `records/{recordId}`.
