import { opportunityTopic } from "./opportunity-brief";

export const pilotBriefs = [
  {
    id: "micro-wedding",
    title: "Rundown pernikahan kecil",
    category: "Perencanaan acara",
    decision: "Uji prototipe",
    demand: "Keyword rundown umum lebih sering dicari daripada keyword planner micro wedding.",
    competition: "Ada template rundown umum sebagai pembanding. Posisi niche acara kecil belum terukur.",
    nextStep: "Buat mockup dan minta tiga pasangan atau penyelenggara acara mencobanya.",
    concept: "Buat rundown satu halaman yang bisa diedit dan dibagikan sebagai PDF ke vendor dan keluarga. Cantumkan jam, penanggung jawab, dan waktu kedatangan vendor.",
    estimate: "3 jam untuk mockup",
    comparison: "Rundown umum punya label konversi High dari Etsy. Keyword planner lebih dekat ke acara kecil, tetapi mencakup format yang lebih luas. Denah meja lebih sering dicari dan perlu diuji pada beberapa tata letak.",
    gap: "Angka untuk micro wedding timeline template belum tersedia. Keyword rundown yang diukur mencakup pernikahan berbagai ukuran.",
    keywords: ["wedding day timeline template", "micro wedding planner", "micro wedding timeline template"],
    tags: ["wedding timeline", "micro wedding", "vendor schedule"],
    differentiation: "Uji apakah satu halaman dengan penanggung jawab lebih mudah dipakai tim tanpa koordinator.",
    risk: "Cek apakah pasangan benar-benar membutuhkan pembagian tugas.",
    test: "Minta tiga pasangan atau penyelenggara mengisi jadwal, menunjuk penanggung jawab, lalu membagikan PDF ke vendor. Lanjut ke uji listing jika minimal dua bisa menyelesaikan skenario tanpa panduan dan mau memakai template untuk acara mereka.",
    evidenceIndices: [0, 1, 2],
    referenceLabels: ["Template rundown pernikahan", "Planner pernikahan kecil"],
  },
  {
    id: "cafe",
    title: "Checklist serah terima shift kafe",
    category: "Operasional kafe",
    decision: "Pantau",
    demand: "Pencarian untuk checklist kafe sedikit pada periode ini.",
    competition: "Ada paket buka/tutup sebagai pembanding. Posisi niche serah terima belum terukur.",
    nextStep: "Tunjukkan sketsa kepada tiga manajer kafe dan bahas pergantian shift terakhir mereka.",
    concept: "Buat satu lembar US Letter yang bisa diedit dan dibagikan sebagai PDF. Sertakan daftar buka/tutup, paraf, dan catatan masalah untuk shift berikutnya.",
    estimate: "2,5 jam untuk mockup",
    comparison: "Template menu lebih sering dicari dan punya label konversi Very low yang sama. Kalkulator harga minuman hanya punya dua pencarian. Istilah food cost calculator mencakup usaha makanan yang lebih luas.",
    gap: "Kebutuhan untuk lembar serah terima khusus belum diuji. Etsy menampilkan Not enough data untuk harga pembelian median checklist.",
    keywords: ["coffee shop checklist", "coffee shop menu template", "coffee shop pricing calculator"],
    tags: ["coffee shop forms", "shift handoff", "opening checklist"],
    differentiation: "Uji kolom khusus untuk masalah yang harus ditangani oleh shift berikutnya.",
    risk: "Cek apakah proses yang ada atau aplikasi POS sudah menangani serah terima.",
    test: "Minta tiga manajer menceritakan masalah pada shift terakhir dan mencoba mengisi sketsa. Buat prototipe jika minimal dua menyebut kejadian nyata dan bersedia mencoba sketsa selama satu shift.",
    evidenceIndices: [0, 2, 3, 4],
    referenceLabels: ["Paket checklist buka/tutup · harga penawaran Rp136.319 saat diamati"],
  },
] as const;

export const pilotDateLabel = "14 Nov 2026";
export const pilotPeriodLabel = "14 Okt–12 Nov 2026";
export const pilotDataStatus = "Data terbatas";
export const pilotDeadline = "Belum ada dasar untuk menetapkan tenggat.";

export const pilotTopics = pilotBriefs.map((brief) => {
  const topic = opportunityTopic(brief.id);
  if (!topic) throw new Error(`Missing pilot topic: ${brief.id}`);
  return { ...brief, topic };
});
