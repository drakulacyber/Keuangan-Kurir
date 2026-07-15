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

// Seed default settings, user, and mock data if database is empty
async function initDatabaseSeed() {
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

  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.bulkAdd([
      { key: 'initialized', value: true },
      { key: 'theme', value: 'dark' }
    ]);
  }

  // Seed mock Uang Masuk
  const incomeCount = await db.income.count();
  if (incomeCount === 0) {
    const today = new Date();
    const d1 = new Date(); d1.setDate(today.getDate() - 15);
    const d2 = new Date(); d2.setDate(today.getDate() - 10);
    const d3 = new Date(); d3.setDate(today.getDate() - 5);
    const d4 = new Date(); d4.setDate(today.getDate() - 2);

    await db.income.bulkAdd([
      { date: d1.toISOString().substring(0, 10), nominal: 1800000, keterangan: 'Gaji Pokok Mingguan' },
      { date: d2.toISOString().substring(0, 10), nominal: 250000, keterangan: 'Insentif Tips Customer' },
      { date: d3.toISOString().substring(0, 10), nominal: 1800000, keterangan: 'Gaji Pokok Mingguan' },
      { date: d4.toISOString().substring(0, 10), nominal: 150000, keterangan: 'Reimbursement Bensin' }
    ]);
  }

  // Seed mock Uang Keluar
  const expenseCount = await db.expense.count();
  if (expenseCount === 0) {
    const today = new Date();
    const d1 = new Date(); d1.setDate(today.getDate() - 12);
    const d2 = new Date(); d2.setDate(today.getDate() - 8);
    const d3 = new Date(); d3.setDate(today.getDate() - 3);

    await db.expense.bulkAdd([
      { date: d1.toISOString().substring(0, 10), nominal: 450000, keterangan: 'Servis Motor Rutin' },
      { date: d2.toISOString().substring(0, 10), nominal: 120000, keterangan: 'Beli Pertamax & Oli' },
      { date: d3.toISOString().substring(0, 10), nominal: 65000, keterangan: 'Makan Siang Kurir' }
    ]);
  }

  // Seed mock Simpanan
  const savingsCount = await db.savings.count();
  if (savingsCount === 0) {
    const today = new Date();
    const d1 = new Date(); d1.setDate(today.getDate() - 14);
    const d2 = new Date(); d2.setDate(today.getDate() - 7);

    await db.savings.bulkAdd([
      { date: d1.toISOString().substring(0, 10), nominal: 150000, keterangan: 'Tabungan Mudik Lebaran' },
      { date: d2.toISOString().substring(0, 10), nominal: 150000, keterangan: 'Tabungan Wajib Mingguan' }
    ]);
  }

  // Seed mock Delivery Harian (35 Hari Terakhir)
  const deliveryCount = await db.deliveries.count();
  if (deliveryCount === 0) {
    const mockDeliveries = [];
    const today = new Date();
    
    // Kita buat data delivery dari 35 hari yang lalu hingga hari ini
    for (let i = 35; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().substring(0, 10);
      
      // Random jumlah delivery per hari antara 45 sampai 95 paket
      const count = Math.floor(Math.random() * 50) + 45;
      
      mockDeliveries.push({
        date: dateStr,
        jumlah: count
      });
    }
    
    await db.deliveries.bulkAdd(mockDeliveries);
  }
}

// Jalankan seed saat loading script
initDatabaseSeed().catch(err => {
  console.error("Gagal melakukan seeding database:", err);
});
