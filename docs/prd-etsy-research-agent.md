# Glimpsea — PRD browser extension

**Status:** Pilot Basic Etsy live berjalan di Opera GX dengan login NEAR testnet, dua trial per akun, checkout, dan laporan privat. Seller dapat membuka hasil scan dan membuat brief peluang dari side panel. Medium dan Deep tersedia dalam simulasi. Chat dengan Seller Agent sudah diimplementasikan dan satu order normal dengan scan Etsy live, pembayaran NEAR testnet, serta PDF telah diverifikasi. Retry dan eskalasi telah diuji dengan kegagalan simulasi.

## Produk dan pengguna

Glimpsea adalah browser extension untuk seller Etsy yang ingin menilai produk apa yang layak mereka buat. Pada MVP chat, seller Etsy menyampaikan kebutuhan riset ke Glimpsea Seller Agent melalui percakapan di Chrome side panel. Agent menangkap keyword, pasar, target pembeli, waktu produksi, modal, dan kategori dari percakapan. Agent meminta klarifikasi hanya jika jawabannya memengaruhi scope. Kategori opsional. Jika kosong, brief membandingkan produk digital, print-on-demand (POD), dan personalisasi sederhana.

Extension adalah jalur utama untuk seller. Backend Glimpsea mengelola akses riset, harga, status, dan pembayaran. Seller Agent memakai Gemini 3.1 Flash-Lite (`gemini-3.1-flash-lite`) untuk memahami percakapan dan menyusun brief chat, menggunakan konfigurasi Gemini seller yang sama dengan alur A2A. A2A tetap tersedia untuk integrasi agen dan pengujian mesin brief. Checkout seller dan akses laporan dikelola oleh akun Glimpsea yang terhubung ke NEAR.

## Demo dua agen dan pembayaran

Buyer menerima permintaan riset Etsy dalam bahasa bebas, meminta klarifikasi jika detail kurang, lalu menyusun order terstruktur. Buyer dan seller memakai API key Gemini terpisah. Buyer menemukan endpoint lewat Agent Card. Seller menghasilkan brief dari referensi yang tersedia dan menyebut batas buktinya. Kode memeriksa anggaran dan status order sebelum buyer mengotorisasi pembayaran.

### Demo Autonomous Business di NEAR testnet

- Demo utama memakai A2A dan pembayaran on-chain di NEAR testnet. Buyer meminta penawaran dan memeriksa anggaran, jaringan, serta penerima sebelum mengirim token faucet langsung dari wallet buyer ke wallet seller yang dikonfigurasi di testnet. Harga mulai 0,01 NEAR testnet dengan pecahan unik per order untuk mencocokkan transfer.
- Seller memeriksa finalitas, akun pembayar, penerima, nominal, dan bahwa hash belum dipakai untuk order lain. Setelah pembayaran terverifikasi, seller menyiapkan brief. Transfer final langsung masuk ke seller. Target pemulihan order yang sudah dibayar mengikuti bagian Retry dan eskalasi owner.
- Buyer menerima tautan **Open the Glimpsea report** ke halaman privat yang sama, dengan ringkasan, detail niche, transparansi, **Limited data**, dan **Download PDF**. Buyer masuk dengan wallet testnet pembayar. Setiap order agent dibayar, tanpa trial atau pemakaian jatah Basic extension.
- Rekam pertukaran order, quote, hash di explorer testnet, lalu laporan dan PDF. Tunjukkan bahwa buyer menolak quote yang melampaui anggaran sebelum menandatangani.

### NEAR Agent Market dan x402

- Listing Glimpsea memakai plan bayar per order. Buyer menemukan Glimpsea dari katalog, membaca Agent Card di subdomain marketplace, meminta quote `402`, lalu mengecek jaringan, aset, penerima, dan nominal dengan konfigurasi yang ditetapkan pengguna. Buyer mengirim kembali pesan yang sama dengan otorisasi x402.
- Agent Market menyediakan endpoint A2A dan menangani otorisasi serta settlement USDC di NEAR mainnet. Worker Glimpsea menerima assignment dengan token agen, memanggil Gemini untuk membuat brief, lalu menyerahkan Markdown ke marketplace. Setelah brief diterima, marketplace mencatat pembayaran di treasury-nya dan menyalurkan bagian penjual ke saldo akun marketplace. Integrasi ini disimpan untuk tahap berikutnya dan belum diuji dengan pembayaran mainnet.
- Buyer agent membayar setiap order melalui x402. Jalur agent tidak menyediakan trial dan tidak menggunakan jatah Basic milik pengguna extension. Buyer bisa meminta quote tanpa pembayaran. Test run gratis pada listing Draft dipakai tim untuk memeriksa worker saat rehearsal. Verifikasi end-to-end berbayar memerlukan akun Agent Market, token agen, listing aktif, dan wallet mainnet yang siap membayar.
- Setelah settlement x402 terverifikasi dan laporan tersimpan, buyer agent menerima ringkasan singkat dan tautan **Open the Glimpsea report**. Tautan membuka dokumen privat di halaman `/reports/<opaque-id>` yang juga dipakai extension, dengan desain Glimpsea, tiga lapis informasi, status **Limited data**, dan tombol **Download PDF**. Demo direkam sampai buyer membuka laporan dan mengunduh PDF setelah pembayaran selesai.
- Satu order menggunakan satu jalur pembayaran. Demo memakai bukti on-chain dari transfer testnet. Pembayaran A2A yang sudah ada dengan skema `glimpsea-simulation` tetap tersedia untuk uji lokal.

[Aturan NEAR Hackathon](https://nearhackathon.com/HACKATHON.md#rules) · [Panduan worker Agent Market dan x402](https://market.near.ai/skill/flows/a2a-x402.md) · [Panduan buyer A2A dan x402](https://docs.market.near.ai/a2a/hire-agent-using-x402)

## Alur chat manusia dengan Seller Agent

1. Buyer membuka side panel dan mengirim permintaan riset dalam bahasa bebas. Chat dan laporan menggunakan bahasa Inggris. Agent dapat memakai keyword dari tab Etsy aktif jika relevan, lalu merangkum scope Basic, target pembeli, dan batas produksi untuk dikonfirmasi oleh buyer.
2. Backend memberi quote Basic untuk scope tersebut. Chat menampilkan biaya riset NEAR testnet sebelum pembayaran. Modal produksi dipakai untuk menyaring ide produk. Buyer manusia dapat menggunakan trial Basic jika masih tersedia. Jika scope berubah sebelum transaksi, backend menerbitkan quote baru.
3. Untuk order berbayar, buyer menghubungkan akun NEAR testnet, masuk dengan tanda tangan login, lalu menyetujui transaksi di wallet. Backend memverifikasi bahwa transaksi final dan cocok dengan order. Riset dimulai setelah pembayaran terverifikasi atau akses trial dikonfirmasi.
4. Agent meneruskan order ke alur scan extension. Content script membaca halaman hasil Etsy yang diizinkan sesuai keyword dan batas paket. Backend menyimpan hasil, cakupan, dan progres. Agent menyampaikan status di chat dan meminta akses browser jika diperlukan untuk melanjutkan scan.
5. Agent menyusun brief dengan Gemini dan menyimpan laporan privat. Buyer menerima ringkasan, status **Limited data** jika buktinya terbatas, serta tautan **Open private report**. Buyer dapat membuka kembali laporan dan memilih **Download PDF** dengan sesi pemilik yang sah. Order normal berjalan sampai laporan diterima tanpa tindakan owner Glimpsea.

### Retry dan eskalasi owner

- Jika riset gagal, agent mencoba ulang secara otomatis dengan order yang sama. Gunakan kembali bukti pembayaran atau reservasi trial dan scan yang berhasil disimpan. Chat menunjukkan bahwa riset sedang dicoba ulang.
- Retry memakai satu ID order, satu pembayaran, dan satu laporan. Refresh, polling paralel, dan pengiriman ulang bukti harus mengembalikan status order yang sama tanpa checkout baru, penagihan ulang, atau pengurangan trial tambahan.
- Setelah retry habis dan laporan masih gagal dibuat, catat satu kasus di daftar penanganan owner. Sertakan ID order, tahap yang gagal, jumlah percobaan, serta status pembayaran dan hash jika ada. Chat memberi tahu buyer bahwa kasus diteruskan untuk ditangani. Order yang berhasil pada retry selesai seperti biasa tanpa eskalasi.

## Paket dan trial

Chat MVP menawarkan Basic. Medium dan Deep dicatat untuk simulasi.

| Paket | Maksimum halaman hasil per riset | Kapan dipakai |
| --- | ---: | --- |
| Basic | 2 | Cek awal untuk satu keyword |
| Medium | 5 | Bandingkan pola yang muncul di lebih banyak hasil |
| Deep | 10 | Tinjau lebih banyak listing sebelum memilih ide |

Satu halaman berarti satu halaman hasil pencarian, termasuk halaman pertama. Batas dihitung dari halaman unik yang berhasil dibaca. Pengulangan atau navigasi kembali tidak menaikkan hitungan. Paket membatasi jumlah halaman yang ditelusuri, bukan jumlah listing yang dijamin tersedia. MVP memakai satu keyword dan satu sumber per pekerjaan.

Setiap akun NEAR mendapat dua trial Basic di extension. Backend mencadangkan satu trial saat job mulai dan menguranginya setelah laporan berhasil. Jika pekerjaan gagal tanpa laporan, backend mengembalikan jatah. Permintaan paralel dari perangkat berbeda tidak bisa mencadangkan trial yang sama. Akun wallet mengikat jatah ke akun dan tidak membuktikan bahwa dua akun berasal dari dua orang berbeda.

Setelah trial, setiap riset butuh satu pembayaran sebelum browsing. Checkout testnet memakai NEAR dari faucet. Harga uji mulai dari 0,01 NEAR untuk Basic, 0,03 untuk Medium, dan 0,06 untuk Deep. Nominal persis unik per pesanan. Backend memverifikasi status final, jenis transfer, nominal, penerima, dan akun pembayar. Satu bukti hanya bisa dipakai untuk satu pesanan. USDC, harga produksi, dan pengembalian dana setelah pembayaran masih perlu diuji sebelum pilot berbayar.

## Data dan analisis

Pilot Basic membaca judul, harga yang tampil, dan URL listing dari DOM halaman hasil pencarian Etsy, tanpa Etsy API. Backend memeriksa akses, merangkum hasil, dan menyimpan laporan privat. Brief peluang menautkan hasil scan dan menunjukkan angka Marketplace Insights dari snapshot untuk keyword yang cocok.

Akses otomatis ke Etsy serta penggunaan datanya sebagai input AI baru diaktifkan jika izin Etsy mencakup kedua penggunaan itu. Ketentuan akses otomatis Etsy juga berlaku ketika extension membaca DOM. [Etsy Terms of Use, bagian 6.E](https://www.etsy.com/legal/terms-of-use)

Simpan hanya data yang diperlukan untuk riset, misalnya ID listing, URL, judul, kategori, harga dan mata uang yang terlihat, posisi hasil, label iklan bila tersedia, serta waktu pengamatan. Hitung listing unik, kisaran harga yang teramati per mata uang, pola format atau personalisasi, dan jumlah halaman aktual. Atribut yang kosong tetap kosong. Jangan mengubah jumlah ulasan, posisi hasil, atau jumlah listing menjadi estimasi penjualan. Harga yang terlihat adalah harga penawaran. [Etsy Search](https://www.etsy.com/seller-handbook/article/375461474487)

Saat membandingkan ide, cek kecocokan dengan keyword dan calon pembeli, kesesuaian dengan batas waktu dan modal seller, biaya atau pemasok yang perlu diverifikasi, dan cara membedakan produk. Prioritaskan ide yang layak dibuat dan murah diuji. Laporan menunjukkan observasi beserta referensi dan menjelaskan keterbatasan sampel. Jika data hanya sintetis, semua temuan dan rekomendasi dari sampel ditandai sebagai demo.

## Laporan

Laporan menyebut keyword, pasar, paket, sumber, tanggal, jumlah halaman aktual, dan listing unik yang dianalisis. Seller mendapat tiga ide lintas kategori bila kategori dikosongkan, atau satu sampai tiga ide untuk kategori pilihan. Setiap ide menjelaskan produk, waktu kerja seller, biaya yang perlu dicek, dan trade-off. Waktu vendor dicatat terpisah. Personalisasi sederhana memakai satu input pembeli. Laporan memilih satu ide dan menjelaskan cara menguji minat sebelum produksi, atau meminta data tambahan jika bukti belum cukup.

Web menampilkan versi bacaan. Backend menyimpan brief dalam JSON berversi untuk akses oleh extension atau agen. Laporan dan data riset tersimpan di backend. Akun NEAR dipakai untuk identitas pemilik dan pencocokan pembayaran.

### Dokumen privat untuk order agent

Order agent memakai halaman dan desain laporan privat Glimpsea yang sudah ada. Backend mengaitkan satu laporan dengan satu order dan identitas buyer yang membayar. Halaman laporan dan unduhan PDF memerlukan sesi buyer yang berhak. Tautan stabil dapat dibuka kembali setelah login tanpa membayar ulang.

Gunakan dua brief pilot sebagai referensi awal saat sesuai dengan topik order. Jika cakupan bukti kurang, tampilkan **Limited data** dan jelaskan data yang masih dibutuhkan.

| Lapis | Isi | Kapan tampil |
| --- | --- | --- |
| **1. Ringkasan peluang** | Hingga tiga niche, satu skor per niche jika data mendukung, satu kalimat singkat per indikator permintaan, persaingan, dan tenggat, serta satu langkah berikutnya. Tampilkan **Limited data** di pilot. Angka mentah tersedia di detail atau transparansi. | Saat laporan dibuka |
| **2. Detail niche** | Alasan rekomendasi, keyword dan tag, ide diferensiasi, risiko termasuk potensi IP atau merek, serta langkah uji. Tampilkan tren 12 minggu dan forecast, posisi listing terhadap kategori, serta kalender produksi bila sumbernya memadai. Untuk setiap indikator tanpa bukti, jelaskan data yang masih dibutuhkan. | Setelah klik **See the test plan** |
| **3. Transparansi** | Sumber dan tanggal pengamatan, cakupan sampel, keterbatasan bukti, metodologi skor, data mentah, ekspor CSV, dan riwayat rekomendasi bila tersedia. Bedakan observasi, estimasi, dan hipotesis. | Saat bagian transparansi dibuka |

Tombol **Download PDF** mengunduh salinan laporan yang sama, dengan tiga lapis dalam urutan yang sama, status **Limited data**, dan sumber yang bisa diperiksa. Bagian yang dapat dibuka-tutup di web ditampilkan lengkap dalam PDF.

## Implementasi dan kriteria penerimaan

- **Chat dan order normal.** Mulai dari satu permintaan bahasa bebas dan pastikan Seller Agent memakai Gemini 3.1 Flash-Lite. Verifikasi klarifikasi, konfirmasi scope, quote Basic, dan satu pembayaran NEAR testnet. Setelah buyer menyetujui pembayaran, pastikan agent memproses scan dan menyerahkan laporan privat serta PDF tanpa tindakan owner.
- **Pemulihan order.** Simulasikan kegagalan riset setelah satu pembayaran final. Pastikan order otomatis dicoba ulang dengan hash yang sama. Uji retry yang berhasil dan retry yang tetap gagal. Kasus pertama menyerahkan satu laporan tanpa eskalasi. Kasus kedua membuat satu laporan pengecualian untuk owner. Keduanya tidak menagih ulang.

- **Extension Chrome.** Manifest V3 dengan side panel yang membuka tab katalog dan mengikuti tautan halaman berikutnya. Content script membaca kartu listing yang tampil. Uji ekstraksi DOM, perpindahan halaman, data yang hilang, serta penyimpanan progres pada halaman HTML demo. [Chrome Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- **Akun NEAR.** Verifikasi pesan NEP-413 dengan nonce sekali pakai, batas waktu, penerima yang tepat, dan kunci akun yang masih berwenang. Uji bahwa akun lain tidak bisa membuka laporan walaupun memiliki URL. [NEP-413](https://github.com/near/NEPs/blob/master/neps/nep-0413.md)
- **Paket dan trial.** Uji bahwa Basic, Medium, dan Deep berhenti pada 2, 5, dan 10 halaman, atau lebih awal jika hasil habis. Uji dua trial Basic dan pastikan job ketiga tertahan sampai pembayaran terverifikasi. Uji retry dan kegagalan agar tidak mengurangi trial atau menagih dua kali.
- **Mesin riset.** Gunakan pesanan contoh `cafe owner supplies` untuk pemilik kafe AS, dengan batas empat jam dan kategori kosong. Brief wajib berisi satu ide digital, satu POD, dan satu personalisasi, serta satu pilihan untuk diuji. Pada demo extension, setiap klaim tentang hasil pencarian harus bisa dirujuk ke katalog demo.
- **Order agent di NEAR testnet.** Quote dan transfer tertunda tidak membuka laporan. Tolak transfer yang berbeda pembayar, penerima, nominal, atau dipakai untuk order lain. Pengiriman ulang hash yang sama untuk order asli mengembalikan task yang sama. Laporan dan PDF tersedia setelah transfer final dan brief tersimpan serta memerlukan sesi wallet testnet pembayar.
- **Order agent x402.** Uji quote, order yang melampaui anggaran, dan order dengan settlement berhasil. Quote, otorisasi yang masih tertunda, atau pembayaran yang gagal tidak membuka laporan privat. Setelah settlement berhasil, buyer mendapat satu tautan stabil. Ulangi pengiriman hasil untuk order yang sama dan pastikan tautannya tetap sama tanpa penagihan tambahan. Pastikan akun lain dan browser tanpa sesi tidak dapat membuka laporan atau mengunduh PDF. Jalur agent tidak menawarkan trial, dan order agent tidak mengurangi jatah Basic di extension.
- **Laporan agent dan PDF.** Buka tautan sebagai buyer dan pastikan halaman laporan Glimpsea menampilkan ketiga lapis serta **Limited data**. Klik **Download PDF** dan periksa bahwa file dapat dibuka serta memuat konten, status, dan sumber dari laporan yang sama.
- **Urutan kerja.** Uji pengambilan data melalui content script pada halaman HTML demo. Gunakan login NEAR, checkout, pembatasan halaman, dan laporan privat yang sudah ada untuk uji alur lengkap sebelum pilot.

## Hasil uji chat Seller Agent · Wedding planner Germany

Pada 15 November 2026 WITA, alur chat di Opera GX menyelesaikan order Basic `39b71c0f-f696-4a61-a188-43a42f778cee`. Scope yang tersimpan adalah `digital wedding planner template`, target wedding planner di Germany (`DE`), maksimal 3 jam untuk prototipe, dan modal USD 5. Backend mencatat satu transfer langsung **0,010000569058912145 NEAR testnet** dari `killerbie.testnet`. Verifikasi RPC independen mengonfirmasi finalitas, hash, akun pembayar, penerima, dan nominal sesuai checkout. [Bukti pembayaran NEAR testnet](https://testnet.nearblocks.io/txns/71zRgkmqLkY7WG2qu9J6JXx1igG1nHkAfc92s9yun3ik)

Extension menyimpan **108 listing unik dari 2 halaman Etsy live**. Gemini menghasilkan brief pada percobaan pertama. PDF berbahasa Inggris terdiri dari 9 halaman dan memuat **Limited data**, tiga ide digital, rekomendasi **Minimalist Wedding Timeline Tracker Template**, rencana uji, listing, serta sumber dan metodologi. Germany adalah pasar yang diminta buyer. Pengaturan **Ship to** Etsy saat scan belum tercatat. Harga yang terlihat adalah harga penawaran dari sesi browser. EUR 5 pada buyer test adalah hipotesis, dan permintaan di Germany belum terukur.

## Hasil uji mesin brief

Pesanan pemilik kafe AS tanpa kategori berhasil diproses lewat A2A dengan pembayaran simulasi 2,50 USDC. NEAR AI Cloud mengembalikan tiga ide: PDF checklist operasional kafe (3 jam), kaus POD (1 jam kerja seller), dan apron dengan nama kafe (4 jam). Brief memilih checklist karena mockup bisa diuji tanpa memesan sampel atau menunggu penawaran vendor. Ini menguji alur dan keluaran mesin brief. Data listing, batas halaman, dan minat pembeli belum diuji dalam run ini.

Uji API simulasi memeriksa batas 2, 5, dan 10 halaman, hasil yang habis lebih awal, pelepasan jatah trial jika analisis gagal, dan akses laporan melalui sesi pemilik. Mode NEAR testnet memakai akun wallet sebagai identitas.

Uji Chromium dengan katalog HTML sintetis memastikan `cafe owner supplies` membuka halaman 1–2 (Basic), 1–5 (Medium), dan 1–10 (Deep). Deep berhenti meskipun halaman 11 tersedia. Untuk `cafe name stamp`, Deep berhenti di halaman 1 karena tidak ada tautan berikutnya. Keempat laporan privat menampilkan judul, harga, dan URL listing yang dibaca dari DOM.

Uji checkout testnet memverifikasi login NEP-413, dua trial, dan laporan yang tetap terikat akun setelah login ulang. Riset ketiga menolak browsing dan analisis sebelum pembayaran. Setelah satu transfer final terverifikasi, riset ketiga selesai dan laporan bisa dibuka pemiliknya. Hash yang sama ditolak untuk pesanan lain. [Bukti pembayaran](https://testnet.nearblocks.io/txns/P93USZtc2iAbELrBuKoy1ddjSm9w4jnmARF6PncqehJ)

Pada uji Basic dengan keyword `cafe owner supplies`, backend membaca dua halaman berisi empat listing sintetis dan mengirim ringkasannya ke NEAR AI Cloud. Brief membandingkan checklist digital (3 jam), tote POD (4 jam), dan apron dengan nama kafe (4 jam). Brief memilih apron untuk diuji lewat mockup kepada lima pemilik kafe. Harga uji merupakan hipotesis. Waktu tunggu dan biaya bordir perlu dikonfirmasi ke vendor.
