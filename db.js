// Inisialisasi Database Menggunakan Dexie.js (IndexedDB wrapper)
const db = new Dexie('KeuanganKurirDB');

// Definisikan Skema Database sesuai dengan tabel yang diminta
db.version(1).stores({
  users: '++id, name, targetDelivery, rate2500, rate3500, ratePetir',
  income: '++id, date, nominal, keterangan',
  expense: '++id, date, nominal, keterangan',
  savings: '++id, date, nominal, keterangan',
  deliveries: '++id, date, jumlah',
  petir: '++id, date, jumlah, periode', // Pelacakan manual data petir jika diperlukan
  settings: 'key, value' // Pasangan kunci-nilai umum untuk konfigurasi aplikasi
});

// Seed default settings and user if database is empty (Starts clean by default)
async function initDatabaseSeed() {
  // Selalu buat profil user default jika kosong
  const userCount = await db.users.count();
  if (userCount === 0) {
    await db.users.add({
      name: 'Kurir Hebat',
      targetDelivery: 2500,
      rate2500: 700,
      rate3500: 1000,
      ratePetir: 3000
    });
  }

  // Selalu buat setting default jika kosong
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.bulkAdd([
      { key: 'initialized', value: true },
      { key: 'theme', value: 'dark' },
      { key: 'seeded', value: true } // Tandai true sejak awal agar tidak re-seed otomatis
    ]);
  }
}

// Jalankan seed saat loading script
initDatabaseSeed().catch(err => {
  console.error("Gagal melakukan seeding database:", err);
});
