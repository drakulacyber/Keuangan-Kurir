/* -------------------------------------------------------------
 * KEUANGAN KURIR - APP.JS
 * Logika Bisnis, Perhitungan Otomatis, Navigasi SPA, Chart.js,
 * Backup/Restore, dan Ekspor Laporan.
 * ------------------------------------------------------------- */

// Variabel Global untuk chart
let chartKeuangan = null;
let chartDeliveryHarian = null;
let chartDeliveryBulanan = null;
let chartBonusPerbandingan = null;

// Konfigurasi Default Pengguna (Akan dimuat dari Database)
let appUser = {
  name: 'Kurir Hebat',
  targetDelivery: 2500,
  rate2500: 700,
  rate3500: 1000,
  ratePetir: 3000
};

// Filter untuk Menu Riwayat
let historyFilters = {
  search: '',
  time: 'semua', // semua, hari, minggu, bulan, tahun
  type: 'semua'  // semua, income, expense, savings, deliveries
};

// Bulan dalam bahasa Indonesia
const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

// Hari dalam bahasa Indonesia
const DAY_NAMES = [
  "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"
];

// ==============================================
// 1. INITIALIZATION & UTILITIES
// ==============================================

window.addEventListener('DOMContentLoaded', async () => {
  // Tunggu sejenak agar db.js melakukan seed jika kosong
  setTimeout(async () => {
    try {
      await initializeApp();
    } catch (e) {
      console.error("Gagal melakukan inisialisasi aplikasi:", e);
      showToast("Gagal memuat database lokal", "error");
    }
  }, 100);
});

async function initializeApp() {
  // Inisialisasi ikon Lucide
  lucide.createIcons();
  
  // Set default input dates ke tanggal hari ini
  setDefaultDates();

  // Muat profil pengguna
  await loadUserProfile();
  
  // Hitung ulang semua data & render dashboard
  await recalculateEverything();

  // Tampilkan tanggal hari ini di header
  updateHeaderDate();

  // Registrasi Service Worker untuk PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker PWA terdaftar dengan scope:', reg.scope))
      .catch(err => console.error('PWA Service Worker gagal didaftarkan:', err));
  }
}

function setDefaultDates() {
  const todayStr = getTodayDateString();
  
  const incomeDate = document.getElementById('income-date');
  const expenseDate = document.getElementById('expense-date');
  const savingsDate = document.getElementById('savings-date');
  const deliveryDate = document.getElementById('delivery-date');
  
  if (incomeDate) incomeDate.value = todayStr;
  if (expenseDate) expenseDate.value = todayStr;
  if (savingsDate) savingsDate.value = todayStr;
  if (deliveryDate) deliveryDate.value = todayStr;
}

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function updateHeaderDate() {
  const today = new Date();
  const dayName = DAY_NAMES[today.getDay()];
  const dateNum = today.getDate();
  const monthName = MONTH_NAMES[today.getMonth()];
  const year = today.getFullYear();
  
  document.getElementById('header-date').innerText = `${dayName}, ${dateNum} ${monthName} ${year}`;
}

async function loadUserProfile() {
  const user = await db.users.toCollection().first();
  if (user) {
    appUser = user;
    document.getElementById('header-username').innerText = user.name;
    document.getElementById('header-avatar').innerText = user.name.charAt(0).toUpperCase();
  }
}

// Format Angka ke Rupiah
function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(number);
}

// Tampilkan Toast
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');
  
  toastMessage.innerText = message;
  toast.className = `toast show toast-${type}`;
  
  // Ubah icon berdasarkan tipe
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';
  
  toastIcon.setAttribute('data-lucide', iconName);
  lucide.createIcons({
    attrs: {
      class: 'lucide-icon'
    },
    nameAttr: 'data-lucide'
  });
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ==============================================
// 2. SPA TAB NAVIGATION
// ==============================================

function switchTab(tabId) {
  // Sembunyikan semua section
  document.querySelectorAll('.app-section').forEach(sec => {
    sec.classList.remove('active');
  });
  
  // Nonaktifkan semua bottom nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Tampilkan section terpilih
  const activeSection = document.getElementById(`${tabId}-section`);
  if (activeSection) {
    activeSection.classList.add('active');
  }
  
  // Aktifkan bottom nav item terpilih
  const activeNav = document.getElementById(`nav-${tabId}`);
  if (activeNav) {
    activeNav.classList.add('active');
  }
  
  // Trigger fungsi load spesifik per tab
  if (tabId === 'dashboard') {
    recalculateEverything();
  } else if (tabId === 'keuangan') {
    loadKeuanganData();
  } else if (tabId === 'delivery') {
    loadDeliveryData();
  } else if (tabId === 'petir') {
    loadPetirData();
  } else if (tabId === 'statistik') {
    updateStatisticsCharts();
  } else if (tabId === 'riwayat') {
    loadHistory();
  } else if (tabId === 'pengaturan') {
    loadSettingsForm();
  }
  
  // Scroll to top
  document.getElementById('app-container').scrollTop = 0;
}

function switchKeuanganTab(subTab) {
  // Sembunyikan semua form keuangan
  document.querySelectorAll('.keuangan-form-container').forEach(c => {
    c.style.display = 'none';
  });
  
  // Nonaktifkan semua sub-tab button
  document.querySelectorAll('#keuangan-section .sub-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Tampilkan form yang sesuai
  document.getElementById(`form-${subTab}-container`).style.display = 'block';
  
  // Aktifkan tombol yang diklik
  event.target.classList.add('active');
  
  if (subTab === 'simpanan') {
    loadSavingsHistory();
  }
}

// ==============================================
// 3. MASTER CALCULATION & DATA RECALCULATOR
// ==============================================

async function recalculateEverything() {
  await loadUserProfile(); // Pastikan profil terupdate
  
  // 1. Ambil data keuangan
  const incomes = await db.income.toArray();
  const expenses = await db.expense.toArray();
  const savings = await db.savings.toArray();
  const deliveries = await db.deliveries.toArray();
  
  // 2. Hitung Saldo Utama
  const totalIncome = incomes.reduce((sum, item) => sum + Number(item.nominal), 0);
  const totalExpense = expenses.reduce((sum, item) => sum + Number(item.nominal), 0);
  const saldoUtama = totalIncome - totalExpense;
  
  // 3. Hitung Saldo Simpanan
  const totalSavings = savings.reduce((sum, item) => sum + Number(item.nominal), 0);
  
  // 4. Update DOM Dashboard Keuangan
  document.getElementById('dash-saldo').innerText = formatRupiah(saldoUtama);
  document.getElementById('dash-simpanan').innerText = formatRupiah(totalSavings);
  document.getElementById('keu-saldo').innerText = formatRupiah(saldoUtama);
  document.getElementById('keu-total-simpanan').innerText = formatRupiah(totalSavings);
  
  // 5. Hitung Delivery Bulan Ini
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11
  
  // Filter delivery di bulan ini
  const monthDeliveries = deliveries.filter(d => {
    const delivDate = new Date(d.date);
    return delivDate.getFullYear() === currentYear && delivDate.getMonth() === currentMonth;
  });
  
  const totalDeliveryMonth = monthDeliveries.reduce((sum, item) => sum + Number(item.jumlah), 0);
  
  // 6. Hitung Bonus Delivery Bulanan
  let bonusDelivery = 0;
  let bonusLabel = "Belum Mencapai Target";
  
  if (totalDeliveryMonth >= 3500) {
    bonusDelivery = totalDeliveryMonth * appUser.rate3500;
    bonusLabel = `Target 3500 Tercapai (${formatRupiah(appUser.rate3500)}/pkt)`;
  } else if (totalDeliveryMonth >= 2500) {
    bonusDelivery = totalDeliveryMonth * appUser.rate2500;
    bonusLabel = `Target 2500 Tercapai (${formatRupiah(appUser.rate2500)}/pkt)`;
  }
  
  document.getElementById('dash-bonus').innerText = formatRupiah(bonusDelivery);
  document.getElementById('dash-bonus-subtitle').innerText = bonusLabel;
  document.getElementById('deliv-bonus-tag').innerText = formatRupiah(bonusDelivery);
  document.getElementById('deliv-total-month').innerText = `${totalDeliveryMonth} paket`;
  
  // 7. Update Dashboard Target & Progress Bar
  const activeTarget = appUser.targetDelivery;
  document.getElementById('dash-delivery-count').innerHTML = `${totalDeliveryMonth} <span style="font-size: 1rem; color: var(--text-secondary);">paket</span>`;
  document.getElementById('dash-progress-target').innerText = `Target: ${activeTarget}`;
  
  const progressPercent = Math.min(100, Math.round((totalDeliveryMonth / activeTarget) * 100));
  document.getElementById('dash-progress-percent').innerText = `${progressPercent}% Tercapai`;
  document.getElementById('dash-progress-bar').style.width = `${progressPercent}%`;
  
  // Warna progress bar
  if (progressPercent >= 100) {
    document.getElementById('dash-progress-bar').style.background = 'var(--color-green)';
    document.getElementById('dash-progress-bar').style.boxShadow = '0 0 10px var(--color-green)';
  } else {
    document.getElementById('dash-progress-bar').style.background = 'var(--color-blue)';
    document.getElementById('dash-progress-bar').style.boxShadow = '0 0 10px var(--color-blue)';
  }
  
  // Status Sisa Target di Dashboard
  const sisaTarget = Math.max(0, activeTarget - totalDeliveryMonth);
  if (sisaTarget > 0) {
    document.getElementById('dash-target-status').innerText = `Kurang ${sisaTarget} paket lagi untuk mencapai target utama (${activeTarget}).`;
  } else {
    document.getElementById('dash-target-status').innerText = `Hebat! Target utama bulanan Anda (${activeTarget} paket) telah terlampaui.`;
  }
  
  // 8. Progress target 2500 dan 3500 di tab Delivery
  const pct2500 = Math.min(100, Math.round((totalDeliveryMonth / 2500) * 100));
  document.getElementById('target-2500-percent').innerText = `${pct2500}%`;
  document.getElementById('bar-target-2500').style.width = `${pct2500}%`;
  
  const sisa2500 = Math.max(0, 2500 - totalDeliveryMonth);
  if (sisa2500 > 0) {
    document.getElementById('target-2500-status').innerHTML = `Kurang <strong style="color: var(--color-blue);">${sisa2500}</strong> delivery untuk bonus target 2500.`;
  } else {
    document.getElementById('target-2500-status').innerHTML = `<span style="color: var(--color-green);">Target 2500 Tercapai! Bonus: ${formatRupiah(totalDeliveryMonth * appUser.rate2500)}</span>`;
  }
  
  const pct3500 = Math.min(100, Math.round((totalDeliveryMonth / 3500) * 100));
  document.getElementById('target-3500-percent').innerText = `${pct3500}%`;
  document.getElementById('bar-target-3500').style.width = `${pct3500}%`;
  
  const sisa3500 = Math.max(0, 3500 - totalDeliveryMonth);
  if (sisa3500 > 0) {
    document.getElementById('target-3500-status').innerHTML = `Kurang <strong style="color: var(--color-blue);">${sisa3500}</strong> delivery untuk bonus target 3500.`;
  } else {
    document.getElementById('target-3500-status').innerHTML = `<span style="color: var(--color-green);">Target 3500 Tercapai! Bonus: ${formatRupiah(totalDeliveryMonth * appUser.rate3500)}</span>`;
  }
  
  // 9. Hitungan Petir
  await recalculatePetir(deliveries);
}

// Menghitung data khusus Petir
async function recalculatePetir(allDeliveries) {
  const today = new Date();
  const period = getPetirPeriodDates(today);
  
  // Tampilkan label periode aktif
  document.getElementById('petir-current-period').innerText = period.label;
  document.getElementById('petir-current-rate').innerText = formatRupiah(appUser.ratePetir);
  
  // Filter delivery pada periode petir saat ini
  const petirDeliveries = allDeliveries.filter(d => {
    const delivDate = new Date(d.date);
    // Bandingkan waktu
    return delivDate >= period.startDate && delivDate <= period.endDate;
  });
  
  const totalDeliveryPetir = petirDeliveries.reduce((sum, item) => sum + Number(item.jumlah), 0);
  const bonusPetir = totalDeliveryPetir * appUser.ratePetir;
  
  document.getElementById('petir-current-count').innerText = `${totalDeliveryPetir} paket`;
  document.getElementById('petir-bonus-total').innerText = formatRupiah(bonusPetir);
}

// Helper Menghitung Tanggal Periode Petir (21 s.d 20)
function getPetirPeriodDates(dateInput) {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-11
  const day = d.getDate();
  
  let startYear, startMonth, endYear, endMonth;
  
  if (day >= 21) {
    // Periode berjalan dimulai tanggal 21 bulan ini
    startYear = year;
    startMonth = month;
    endMonth = month + 1;
    if (endMonth > 11) {
      endMonth = 0;
      endYear = year + 1;
    } else {
      endYear = year;
    }
  } else {
    // Periode berjalan dimulai tanggal 21 bulan lalu
    endMonth = month;
    endYear = year;
    startMonth = month - 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear = year - 1;
    } else {
      startYear = year;
    }
  }
  
  // Format Date objek. Mulai tanggal 21 jam 00:00:00 s.d tanggal 20 jam 23:59:59
  const startDate = new Date(startYear, startMonth, 21, 0, 0, 0, 0);
  const endDate = new Date(endYear, endMonth, 20, 23, 59, 59, 999);
  
  // Label format Indonesia: "21 Juni 2026 - 20 Juli 2026"
  const startMonthLabel = MONTH_NAMES[startMonth].substring(0, 3);
  const endMonthLabel = MONTH_NAMES[endMonth].substring(0, 3);
  
  const label = `21 ${startMonthLabel} ${startYear} - 20 ${endMonthLabel} ${endYear}`;
  const idPeriode = `${startYear}-${String(startMonth+1).padStart(2, '0')}-21_${endYear}-${String(endMonth+1).padStart(2, '0')}-20`;
  
  return { startDate, endDate, label, idPeriode };
}

// ==============================================
// 4. DATABASE CRUD EVENT HANDLERS
// ==============================================

// Form Uang Masuk
async function handleIncomeSubmit(e) {
  e.preventDefault();
  const dateVal = document.getElementById('income-date').value;
  const amountVal = Number(document.getElementById('income-amount').value);
  const descVal = document.getElementById('income-desc').value;
  
  if (!dateVal || amountVal <= 0 || !descVal) {
    showToast("Isi form dengan benar!", "error");
    return;
  }
  
  await db.income.add({
    date: dateVal,
    nominal: amountVal,
    keterangan: descVal
  });
  
  document.getElementById('income-amount').value = '';
  document.getElementById('income-desc').value = '';
  setDefaultDates();
  
  showToast("Uang Masuk berhasil disimpan!", "success");
  await recalculateEverything();
  
  // Redirect ke Riwayat agar user bisa melihat hasilnya langsung
  setTimeout(() => {
    switchTab('riwayat');
    setHistoryTypeFilter('income');
  }, 500);
}

// Form Uang Keluar
async function handleExpenseSubmit(e) {
  e.preventDefault();
  const dateVal = document.getElementById('expense-date').value;
  const amountVal = Number(document.getElementById('expense-amount').value);
  const descVal = document.getElementById('expense-desc').value;
  
  if (!dateVal || amountVal <= 0 || !descVal) {
    showToast("Isi form dengan benar!", "error");
    return;
  }
  
  await db.expense.add({
    date: dateVal,
    nominal: amountVal,
    keterangan: descVal
  });
  
  document.getElementById('expense-amount').value = '';
  document.getElementById('expense-desc').value = '';
  setDefaultDates();
  
  showToast("Uang Keluar berhasil disimpan!", "success");
  await recalculateEverything();
  
  setTimeout(() => {
    switchTab('riwayat');
    setHistoryTypeFilter('expense');
  }, 500);
}

// Form Simpanan
async function handleSavingsSubmit(e) {
  e.preventDefault();
  const dateVal = document.getElementById('savings-date').value;
  const amountVal = Number(document.getElementById('savings-amount').value);
  const descVal = document.getElementById('savings-desc').value;
  
  if (!dateVal || amountVal <= 0 || !descVal) {
    showToast("Isi form dengan benar!", "error");
    return;
  }
  
  await db.savings.add({
    date: dateVal,
    nominal: amountVal,
    keterangan: descVal
  });
  
  document.getElementById('savings-amount').value = '';
  document.getElementById('savings-desc').value = '';
  setDefaultDates();
  
  showToast("Simpanan berhasil disimpan!", "success");
  await recalculateEverything();
  await loadSavingsHistory();
}

// Form Delivery Harian
async function handleDeliverySubmit(e) {
  e.preventDefault();
  const dateVal = document.getElementById('delivery-date').value;
  const countVal = Number(document.getElementById('delivery-count').value);
  
  if (!dateVal || countVal <= 0) {
    showToast("Isi form dengan benar!", "error");
    return;
  }
  
  await db.deliveries.add({
    date: dateVal,
    jumlah: countVal
  });
  
  document.getElementById('delivery-count').value = '';
  setDefaultDates();
  
  showToast("Data delivery disimpan!", "success");
  await recalculateEverything();
  await loadDeliveryData();
}

// Load Tab Keuangan
function loadKeuanganData() {
  recalculateEverything();
}

// Load Tab Simpanan Riwayat Mini
async function loadSavingsHistory() {
  const savings = await db.savings.orderBy('date').reverse().limit(10).toArray();
  const container = document.getElementById('keu-savings-history');
  
  if (savings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="piggy-bank"></i>
        Belum ada riwayat simpanan.
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  container.innerHTML = savings.map(item => {
    const formattedDate = formatDateIndonesianShort(item.date);
    return `
      <div class="list-item">
        <div class="item-left">
          <div class="item-title">${item.keterangan}</div>
          <div class="item-date">${formattedDate}</div>
        </div>
        <div class="item-right">
          <div class="item-amount amount-neutral">${formatRupiah(item.nominal)}</div>
          <button class="delete-btn" onclick="deleteItem('savings', ${item.id})" title="Hapus">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

// Load Tab Delivery
async function loadDeliveryData() {
  await recalculateEverything();
  
  // Ambil delivery hari ini
  const todayStr = getTodayDateString();
  const todayDeliv = await db.deliveries.where('date').equals(todayStr).toArray();
  const totalToday = todayDeliv.reduce((sum, item) => sum + item.jumlah, 0);
  
  document.getElementById('deliv-today').innerText = `${totalToday} pkt`;
  
  // Hitung rata-rata
  const deliveries = await db.deliveries.toArray();
  
  // Ambil data bulan ini
  const today = new Date();
  const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const thisMonthDeliv = deliveries.filter(d => d.date.startsWith(monthStr));
  
  // Rata-rata: Total Delivery Bulan Ini / Jumlah hari yang memiliki input delivery di bulan ini
  const uniqueActiveDays = [...new Set(thisMonthDeliv.map(d => d.date))].length;
  const totalThisMonth = thisMonthDeliv.reduce((sum, d) => sum + d.jumlah, 0);
  
  const avg = uniqueActiveDays > 0 ? Math.round(totalThisMonth / uniqueActiveDays) : 0;
  
  document.getElementById('deliv-avg').innerText = `${avg} pkt/hari`;

  // Render Riwayat Delivery Terakhir
  await loadDeliveryHistory();
}

// Render daftar delivery harian terakhir di tab Delivery
async function loadDeliveryHistory() {
  const deliveries = await db.deliveries.orderBy('date').reverse().limit(10).toArray();
  const container = document.getElementById('deliv-history-list');
  
  if (deliveries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="package"></i>
        Belum ada riwayat delivery harian.
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  container.innerHTML = deliveries.map(item => {
    const formattedDate = formatDateIndonesianShort(item.date);
    return `
      <div class="list-item">
        <div class="item-left">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="package" style="width: 16px; height: 16px; color: var(--text-secondary);"></i>
            <div class="item-title">${item.jumlah} Paket</div>
          </div>
          <div class="item-date" style="margin-left: 24px;">${formattedDate}</div>
        </div>
        <div class="item-right">
          <button class="delete-btn" onclick="deleteItem('deliveries', ${item.id})" title="Hapus">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

// Load Tab Petir
async function loadPetirData() {
  await recalculateEverything();
  
  const today = new Date();
  const currentPeriod = getPetirPeriodDates(today);
  
  // Render rincian delivery periode petir aktif saat ini
  await loadPetirDeliveries(currentPeriod);
  
  // Hitung riwayat petir periode sebelumnya secara berkelompok
  const deliveries = await db.deliveries.toArray();
  const container = document.getElementById('petir-history-list');
  
  if (deliveries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="zap-off"></i>
        Belum ada data delivery untuk menghitung periode.
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  // Kelompokkan delivery berdasarkan periode petirnya
  const periodGroups = {};
  
  deliveries.forEach(d => {
    const dDate = new Date(d.date);
    const period = getPetirPeriodDates(dDate);
    const key = period.idPeriode;
    
    if (!periodGroups[key]) {
      periodGroups[key] = {
        label: period.label,
        total: 0,
        startDate: period.startDate
      };
    }
    periodGroups[key].total += d.jumlah;
  });
  
  // Urutkan berdasarkan tanggal mulai secara menurun (terbaru di atas)
  const sortedPeriods = Object.values(periodGroups).sort((a, b) => b.startDate - a.startDate);
  
  // Hapus periode saat ini dari riwayat historis
  const historicPeriods = sortedPeriods.filter(p => p.label !== currentPeriod.label);
  
  if (historicPeriods.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="info"></i>
        Belum ada riwayat periode petir sebelumnya.
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  container.innerHTML = historicPeriods.map(p => {
    const bonusVal = p.total * appUser.ratePetir;
    return `
      <div class="list-item">
        <div class="item-left">
          <div class="item-title" style="font-size: 0.85rem;">${p.label}</div>
          <div class="item-date">${p.total} paket</div>
        </div>
        <div class="item-right">
          <div class="item-amount" style="color: #FBBF24;">${formatRupiah(bonusVal)}</div>
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

// Render rincian delivery yang berkontribusi ke periode petir aktif saat ini
async function loadPetirDeliveries(period) {
  const deliveries = await db.deliveries.toArray();
  
  // Filter delivery yang tanggalnya ada dalam rentang periode petir aktif
  const activePetirDelivs = deliveries.filter(d => {
    const delivDate = new Date(d.date);
    return delivDate >= period.startDate && delivDate <= period.endDate;
  });
  
  // Urutkan tanggal terbaru di atas
  activePetirDelivs.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const container = document.getElementById('petir-deliveries-list');
  
  if (activePetirDelivs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="zap-off"></i>
        Belum ada delivery pada periode petir aktif ini.
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  container.innerHTML = activePetirDelivs.map(item => {
    const formattedDate = formatDateIndonesianShort(item.date);
    const bonusVal = item.jumlah * appUser.ratePetir;
    return `
      <div class="list-item">
        <div class="item-left">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="zap" style="width: 16px; height: 16px; color: #FBBF24;"></i>
            <div class="item-title">${item.jumlah} Paket</div>
          </div>
          <div class="item-date" style="margin-left: 24px;">${formattedDate}</div>
        </div>
        <div class="item-right">
          <div class="item-amount" style="color: #FBBF24;">+ ${formatRupiah(bonusVal)}</div>
          <button class="delete-btn" onclick="deleteItem('deliveries', ${item.id})" title="Hapus">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

// Delete Item dari Riwayat
async function deleteItem(type, id) {
  if (confirm("Apakah Anda yakin ingin menghapus data ini?")) {
    await db[type].delete(id);
    showToast("Data berhasil dihapus!", "success");
    
    // Refresh halaman/tab aktif
    const activeSection = document.querySelector('.app-section.active').id;
    if (activeSection === 'riwayat-section') {
      await loadHistory();
    } else if (activeSection === 'keuangan-section') {
      await loadSavingsHistory();
    } else if (activeSection === 'delivery-section') {
      await loadDeliveryData();
    } else if (activeSection === 'petir-section') {
      await loadPetirData();
    }
    await recalculateEverything();
  }
}

// Helper format tanggal singkat: "15 Jul 2026"
function formatDateIndonesianShort(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dateNum = d.getDate();
  const monthName = MONTH_NAMES[d.getMonth()].substring(0, 3);
  const year = d.getFullYear();
  return `${dateNum} ${monthName} ${year}`;
}

// ==============================================
// 5. RIWAYAT DATA DENGAN PENCARIAN & FILTER
// ==============================================

async function loadHistory() {
  const searchInput = document.getElementById('history-search');
  if (searchInput) historyFilters.search = searchInput.value.toLowerCase();
  
  const mainHistoryContainer = document.getElementById('main-history-list');
  
  // Ambil semua data dari IndexedDB
  const incomes = (await db.income.toArray()).map(item => ({ ...item, type: 'income' }));
  const expenses = (await db.expense.toArray()).map(item => ({ ...item, type: 'expense' }));
  const savings = (await db.savings.toArray()).map(item => ({ ...item, type: 'savings' }));
  const deliveries = (await db.deliveries.toArray()).map(item => ({ ...item, type: 'deliveries', keterangan: `${item.jumlah} paket` }));
  
  // Gabungkan semua data
  let combined = [...incomes, ...expenses, ...savings, ...deliveries];
  
  // 1. Filter tipe data
  if (historyFilters.type !== 'semua') {
    combined = combined.filter(item => item.type === historyFilters.type);
  }
  
  // 2. Filter Waktu
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Senin
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  
  if (historyFilters.time !== 'semua') {
    combined = combined.filter(item => {
      const itemDate = new Date(item.date);
      itemDate.setHours(0,0,0,0);
      
      if (historyFilters.time === 'hari') {
        return itemDate.getTime() === today.getTime();
      } else if (historyFilters.time === 'minggu') {
        return itemDate >= startOfWeek;
      } else if (historyFilters.time === 'bulan') {
        return itemDate >= startOfMonth;
      } else if (historyFilters.time === 'tahun') {
        return itemDate >= startOfYear;
      }
      return true;
    });
  }
  
  // 3. Filter Pencarian Keterangan
  if (historyFilters.search.trim() !== '') {
    combined = combined.filter(item => {
      return item.keterangan && item.keterangan.toLowerCase().includes(historyFilters.search);
    });
  }
  
  // Urutkan berdasarkan tanggal terbaru di atas
  combined.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (combined.length === 0) {
    mainHistoryContainer.innerHTML = `
      <div class="empty-state">
        <i data-lucide="search-code"></i>
        Tidak ada data yang cocok dengan kriteria.
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  // Render List
  mainHistoryContainer.innerHTML = combined.map(item => {
    let typeLabel = '';
    let amountClass = 'amount-neutral';
    let nominalText = formatRupiah(item.nominal);
    let iconName = 'arrow-right-left';
    
    if (item.type === 'income') {
      typeLabel = '<span class="badge badge-green">Masuk</span>';
      amountClass = 'amount-income';
      nominalText = `+ ${formatRupiah(item.nominal)}`;
      iconName = 'arrow-down-left';
    } else if (item.type === 'expense') {
      typeLabel = '<span class="badge" style="background-color: var(--color-red-glow); color: var(--color-red);">Keluar</span>';
      amountClass = 'amount-expense';
      nominalText = `- ${formatRupiah(item.nominal)}`;
      iconName = 'arrow-up-right';
    } else if (item.type === 'savings') {
      typeLabel = '<span class="badge badge-blue">Simpanan</span>';
      amountClass = 'amount-neutral';
      iconName = 'piggy-bank';
    } else if (item.type === 'deliveries') {
      typeLabel = '<span class="badge" style="background-color: rgba(245,158,11,0.15); color: var(--color-yellow);">Delivery</span>';
      amountClass = 'amount-neutral';
      nominalText = `${item.jumlah} pkt`;
      iconName = 'package';
    }
    
    const formattedDate = formatDateIndonesianShort(item.date);
    
    return `
      <div class="list-item">
        <div class="item-left">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="${iconName}" style="width: 16px; height: 16px; color: var(--text-secondary);"></i>
            <div class="item-title">${item.keterangan}</div>
          </div>
          <div class="item-date" style="margin-left: 24px;">${formattedDate} ${typeLabel}</div>
        </div>
        <div class="item-right">
          <div class="item-amount ${amountClass}">${nominalText}</div>
          <button class="delete-btn" onclick="deleteItem('${item.type}', ${item.id})" title="Hapus">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

function filterHistory() {
  loadHistory();
}

function setHistoryTimeFilter(timeVal) {
  historyFilters.time = timeVal;
  
  // Ganti kelas aktif di pill
  const pills = document.querySelectorAll('#riwayat-section .filter-pills:first-of-type .filter-pill');
  pills.forEach(pill => {
    pill.classList.remove('active');
    if (pill.getAttribute('onclick').includes(`'${timeVal}'`)) {
      pill.classList.add('active');
    }
  });
  
  loadHistory();
}

function setHistoryTypeFilter(typeVal) {
  historyFilters.type = typeVal;
  
  // Ganti kelas aktif di pill jenis
  const pills = document.querySelectorAll('#riwayat-section .filter-pills:nth-of-type(2) .filter-pill');
  pills.forEach(pill => {
    pill.classList.remove('active');
    if (pill.getAttribute('onclick').includes(`'${typeVal}'`)) {
      pill.classList.add('active');
    }
  });
  
  loadHistory();
}

// ==============================================
// 6. VISUALISASI & STATISTIK (CHART.JS)
// ==============================================

async function updateStatisticsCharts() {
  // Matikan dan bersihkan grafik lama jika ada
  if (chartKeuangan) chartKeuangan.destroy();
  if (chartDeliveryHarian) chartDeliveryHarian.destroy();
  if (chartDeliveryBulanan) chartDeliveryBulanan.destroy();
  if (chartBonusPerbandingan) chartBonusPerbandingan.destroy();

  const incomes = await db.income.toArray();
  const expenses = await db.expense.toArray();
  const savings = await db.savings.toArray();
  const deliveries = await db.deliveries.toArray();

  // Pengaturan Chart Global Font
  Chart.defaults.color = '#9CA3AF';
  Chart.defaults.font.family = 'Inter';

  // --- CHART 1: KEUANGAN (MASUK vs KELUAR vs SIMPANAN) bulanan ---
  const financeMonthlyData = groupFinanceByMonth(incomes, expenses, savings);
  const months = financeMonthlyData.labels;

  const ctxKeuangan = document.getElementById('chart-keuangan').getContext('2d');
  chartKeuangan = new Chart(ctxKeuangan, {
    type: 'bar',
    data: {
      labels: months.length > 0 ? months : ['No Data'],
      datasets: [
        {
          label: 'Uang Masuk',
          data: financeMonthlyData.income,
          backgroundColor: '#10B981',
          borderColor: '#10B981',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Uang Keluar',
          data: financeMonthlyData.expense,
          backgroundColor: '#EF4444',
          borderColor: '#EF4444',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Simpanan',
          data: financeMonthlyData.savings,
          backgroundColor: '#3B82F6',
          borderColor: '#3B82F6',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' } }
      },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12 } }
      }
    }
  });

  // --- CHART 2: DELIVERY HARIAN (30 Hari Terakhir) ---
  const delivHarianData = groupDeliveryDaily(deliveries);
  const ctxDelivHarian = document.getElementById('chart-delivery-harian').getContext('2d');
  
  chartDeliveryHarian = new Chart(ctxDelivHarian, {
    type: 'line',
    data: {
      labels: delivHarianData.labels.length > 0 ? delivHarianData.labels : ['No Data'],
      datasets: [{
        label: 'Jumlah Paket',
        data: delivHarianData.values,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#3B82F6'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  // --- CHART 3: DELIVERY BULANAN ---
  const delivBulananData = groupDeliveryMonthly(deliveries);
  const ctxDelivBulanan = document.getElementById('chart-delivery-bulanan').getContext('2d');
  
  chartDeliveryBulanan = new Chart(ctxDelivBulanan, {
    type: 'bar',
    data: {
      labels: delivBulananData.labels.length > 0 ? delivBulananData.labels : ['No Data'],
      datasets: [{
        label: 'Total Paket',
        data: delivBulananData.values,
        backgroundColor: '#10B981',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  // --- CHART 4: PERBANDINGAN BONUS (Delivery vs Petir) ---
  const bonusData = calculateMonthlyBonusStats(deliveries);
  const ctxBonus = document.getElementById('chart-bonus-perbandingan').getContext('2d');
  
  chartBonusPerbandingan = new Chart(ctxBonus, {
    type: 'bar',
    data: {
      labels: bonusData.labels.length > 0 ? bonusData.labels : ['No Data'],
      datasets: [
        {
          label: 'Bonus Delivery',
          data: bonusData.deliveryBonus,
          backgroundColor: '#3B82F6',
          borderRadius: 6
        },
        {
          label: 'Bonus Petir',
          data: bonusData.petirBonus,
          backgroundColor: '#FBBF24',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' } }
      },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12 } }
      }
    }
  });
}

// Helpers Grouping untuk Grafik

function groupFinanceByMonth(incomes, expenses, savings) {
  const data = {};
  
  incomes.forEach(i => {
    const m = i.date.substring(0, 7); // YYYY-MM
    if (!data[m]) data[m] = { income: 0, expense: 0, savings: 0 };
    data[m].income += i.nominal;
  });
  
  expenses.forEach(e => {
    const m = e.date.substring(0, 7);
    if (!data[m]) data[m] = { income: 0, expense: 0, savings: 0 };
    data[m].expense += e.nominal;
  });
  
  savings.forEach(s => {
    const m = s.date.substring(0, 7);
    if (!data[m]) data[m] = { income: 0, expense: 0, savings: 0 };
    data[m].savings += s.nominal;
  });
  
  const sortedMonths = Object.keys(data).sort();
  // Ambil maksimal 6 bulan terakhir
  const lastMonths = sortedMonths.slice(-6);
  
  return {
    labels: lastMonths.map(m => formatMonthLabelShort(m)),
    income: lastMonths.map(m => data[m].income),
    expense: lastMonths.map(m => data[m].expense),
    savings: lastMonths.map(m => data[m].savings)
  };
}

function groupDeliveryDaily(deliveries) {
  // Ambil data 30 hari terakhir
  const dailyData = {};
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const key = d.toISOString().substring(0, 10);
    dailyData[key] = 0;
  }
  
  deliveries.forEach(deliv => {
    if (dailyData[deliv.date] !== undefined) {
      dailyData[deliv.date] += deliv.jumlah;
    }
  });
  
  const keys = Object.keys(dailyData).sort();
  
  return {
    labels: keys.map(k => k.substring(8, 10) + '/' + k.substring(5, 7)),
    values: keys.map(k => dailyData[k])
  };
}

function groupDeliveryMonthly(deliveries) {
  const data = {};
  
  deliveries.forEach(d => {
    const m = d.date.substring(0, 7); // YYYY-MM
    if (!data[m]) data[m] = 0;
    data[m] += d.jumlah;
  });
  
  const sortedMonths = Object.keys(data).sort();
  const lastMonths = sortedMonths.slice(-6);
  
  return {
    labels: lastMonths.map(m => formatMonthLabelShort(m)),
    values: lastMonths.map(m => data[m])
  };
}

function calculateMonthlyBonusStats(deliveries) {
  const monthlyCounts = {};
  
  // Kelompokkan jumlah delivery per bulan calendar (YYYY-MM)
  deliveries.forEach(d => {
    const m = d.date.substring(0, 7);
    if (!monthlyCounts[m]) monthlyCounts[m] = 0;
    monthlyCounts[m] += d.jumlah;
  });
  
  const sortedMonths = Object.keys(monthlyCounts).sort().slice(-6);
  const deliveryBonus = [];
  const petirBonus = [];
  
  sortedMonths.forEach(m => {
    const count = monthlyCounts[m];
    // Hitung bonus bulanan standar
    let bDeliv = 0;
    if (count >= 3500) {
      bDeliv = count * appUser.rate3500;
    } else if (count >= 2500) {
      bDeliv = count * appUser.rate2500;
    }
    deliveryBonus.push(bDeliv);
    
    // Hitung bonus petir dalam bulan ini secara estimasi
    // Kita cari delivery yang jatuh di periode petir bulan bersangkutan
    // Yaitu dari tanggal 21 bulan lalu s.d 20 bulan m
    const year = parseInt(m.substring(0, 4));
    const month = parseInt(m.substring(5, 7)) - 1; // 0-indexed
    
    const pStart = new Date(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, 21, 0, 0, 0, 0);
    const pEnd = new Date(year, month, 20, 23, 59, 59, 999);
    
    const petirCount = deliveries.filter(d => {
      const dDate = new Date(d.date);
      return dDate >= pStart && dDate <= pEnd;
    }).reduce((sum, item) => sum + item.jumlah, 0);
    
    petirBonus.push(petirCount * appUser.ratePetir);
  });
  
  return {
    labels: sortedMonths.map(m => formatMonthLabelShort(m)),
    deliveryBonus,
    petirBonus
  };
}

function formatMonthLabelShort(monthStr) {
  const parts = monthStr.split('-');
  const mIndex = parseInt(parts[1]) - 1;
  return `${MONTH_NAMES[mIndex].substring(0, 3)} ${parts[0].substring(2, 4)}`;
}

// ==============================================
// 7. SETTINGS, PROFILE, & PREFERENCES
// ==============================================

function loadSettingsForm() {
  document.getElementById('settings-name').value = appUser.name;
  document.getElementById('settings-target').value = appUser.targetDelivery;
  document.getElementById('settings-rate-2500').value = appUser.rate2500;
  document.getElementById('settings-rate-3500').value = appUser.rate3500;
  document.getElementById('settings-rate-petir').value = appUser.ratePetir;
}

async function handleSettingsSave(e) {
  e.preventDefault();
  const nameVal = document.getElementById('settings-name').value;
  const targetVal = Number(document.getElementById('settings-target').value);
  const rate2500Val = Number(document.getElementById('settings-rate-2500').value);
  const rate3500Val = Number(document.getElementById('settings-rate-3500').value);
  const ratePetirVal = Number(document.getElementById('settings-rate-petir').value);
  
  if (!nameVal || targetVal <= 0 || rate2500Val <= 0 || rate3500Val <= 0 || ratePetirVal <= 0) {
    showToast("Isi form dengan benar!", "error");
    return;
  }
  
  const user = await db.users.toCollection().first();
  if (user) {
    await db.users.update(user.id, {
      name: nameVal,
      targetDelivery: targetVal,
      rate2500: rate2500Val,
      rate3500: rate3500Val,
      ratePetir: ratePetirVal
    });
  } else {
    await db.users.add({
      name: nameVal,
      targetDelivery: targetVal,
      rate2500: rate2500Val,
      rate3500: rate3500Val,
      ratePetir: ratePetirVal
    });
  }
  
  showToast("Pengaturan berhasil disimpan!", "success");
  await recalculateEverything();
  await loadUserProfile();
  
  setTimeout(() => {
    switchTab('dashboard');
  }, 1000);
}

// ==============================================
// 8. DATA PORTABILITY (BACKUP & RESTORE)
// ==============================================

// Backup Database ke file JSON
async function backupDatabase() {
  try {
    const backupData = {
      users: await db.users.toArray(),
      income: await db.income.toArray(),
      expense: await db.expense.toArray(),
      savings: await db.savings.toArray(),
      deliveries: await db.deliveries.toArray(),
      settings: await db.settings.toArray()
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    
    const todayStr = getTodayDateString().replace(/-/g, '');
    
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `keuangan_kurir_backup_${todayStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    
    showToast("Backup berhasil diunduh!", "success");
  } catch (err) {
    console.error(err);
    showToast("Gagal melakukan backup", "error");
  }
}

// Trigger input file restore
function triggerRestoreUpload() {
  document.getElementById('restore-file-input').click();
}

// Restore Database dari file JSON
async function restoreDatabase(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      
      // Validasi sederhana
      if (!data.users || !data.income || !data.expense || !data.savings || !data.deliveries) {
        showToast("Format file backup tidak valid!", "error");
        return;
      }
      
      // Konfirmasi overwriting
      if (!confirm("Mengembalikan data akan menghapus semua data saat ini. Apakah Anda yakin?")) {
        return;
      }
      
      // Bersihkan dan masukkan data baru
      await db.transaction('rw', [db.users, db.income, db.expense, db.savings, db.deliveries, db.settings], async () => {
        await db.users.clear();
        await db.income.clear();
        await db.expense.clear();
        await db.savings.clear();
        await db.deliveries.clear();
        await db.settings.clear();
        
        await db.users.bulkAdd(data.users);
        await db.income.bulkAdd(data.income);
        await db.expense.bulkAdd(data.expense);
        await db.savings.bulkAdd(data.savings);
        await db.deliveries.bulkAdd(data.deliveries);
        if (data.settings) await db.settings.bulkAdd(data.settings);
      });
      
      showToast("Data berhasil dipulihkan!", "success");
      await recalculateEverything();
      await loadUserProfile();
      
      // Reset input file
      e.target.value = '';
      
      switchTab('dashboard');
    } catch (err) {
      console.error(err);
      showToast("Gagal memproses file backup JSON", "error");
    }
  };
  reader.readAsText(file);
}

// ==============================================
// 9. DATA EXPORTS (CSV, EXCEL, PDF REPORT)
// ==============================================

// Ekspor ke CSV / Excel (XML BOM Format)
async function exportData(format = 'csv') {
  const incomes = await db.income.toArray();
  const expenses = await db.expense.toArray();
  const savings = await db.savings.toArray();
  const deliveries = await db.deliveries.toArray();
  
  let csvContent = "";
  let filename = "";
  
  const separator = format === 'excel' ? '\t' : ',';
  const fileExt = format === 'excel' ? 'xls' : 'csv';
  const mimeType = format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv';
  
  // Format Header & Baris Transaksi Keuangan
  csvContent += `TIPE${separator}TANGGAL${separator}NOMINAL${separator}KETERANGAN\n`;
  
  incomes.forEach(i => {
    csvContent += `Masuk${separator}${i.date}${separator}${i.nominal}${separator}"${i.keterangan}"\n`;
  });
  expenses.forEach(e => {
    csvContent += `Keluar${separator}${e.date}${separator}${e.nominal}${separator}"${e.keterangan}"\n`;
  });
  savings.forEach(s => {
    csvContent += `Simpanan${separator}${s.date}${separator}${s.nominal}${separator}"${s.keterangan}"\n`;
  });
  deliveries.forEach(d => {
    csvContent += `Delivery${separator}${d.date}${separator}${d.jumlah}${separator}"Delivery Harian"\n`;
  });
  
  filename = `laporan_keuangan_kurir.${fileExt}`;
  
  // Tambahkan BOM untuk support Excel UTF-8
  const blob = new Blob(["\ufeff" + csvContent], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast(`Berhasil mengekspor format ${format.toUpperCase()}!`, "success");
}

// Ekspor Laporan PDF (Menggunakan html2pdf.js secara clean)
async function exportPDFReport() {
  showToast("Menyiapkan ekspor PDF...", "info");
  
  // Ambil ringkasan
  const incomes = await db.income.toArray();
  const expenses = await db.expense.toArray();
  const savings = await db.savings.toArray();
  const deliveries = await db.deliveries.toArray();
  
  const totalIncome = incomes.reduce((sum, item) => sum + item.nominal, 0);
  const totalExpense = expenses.reduce((sum, item) => sum + item.nominal, 0);
  const totalSavings = savings.reduce((sum, item) => sum + item.nominal, 0);
  const totalDelivery = deliveries.reduce((sum, item) => sum + item.jumlah, 0);
  
  // Buat element tersembunyi untuk template PDF
  const reportEl = document.createElement('div');
  reportEl.style.padding = '40px';
  reportEl.style.color = '#333333';
  reportEl.style.backgroundColor = '#ffffff';
  reportEl.style.fontFamily = 'Arial, sans-serif';
  reportEl.style.fontSize = '12px';
  reportEl.style.lineHeight = '1.6';
  
  const today = new Date();
  const dateStr = `${today.getDate()} ${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
  
  // Template Laporan PDF Modern
  reportEl.innerHTML = `
    <div style="border-bottom: 2px solid #3B82F6; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h1 style="color: #1E3A8A; margin: 0; font-size: 24px;">LAPORAN KEUANGAN & PERFORMANCE KURIR</h1>
        <p style="margin: 5px 0 0 0; color: #666;">Dicetak pada: ${dateStr}</p>
      </div>
      <div style="text-align: right;">
        <h3 style="margin: 0; color: #3B82F6;">Keuangan Kurir Pro</h3>
        <p style="margin: 2px 0 0 0; font-size: 10px; color: #888;">Database: IndexedDB</p>
      </div>
    </div>
    
    <div style="margin-bottom: 25px;">
      <h2 style="color: #1E3A8A; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 12px;">Profil Pengguna</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="width: 30%; font-weight: bold; padding: 4px 0;">Nama Kurir:</td>
          <td>${appUser.name}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; padding: 4px 0;">Target Bulanan:</td>
          <td>${appUser.targetDelivery} Paket</td>
        </tr>
      </table>
    </div>

    <div style="margin-bottom: 25px;">
      <h2 style="color: #1E3A8A; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 12px;">Ringkasan Finansial</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background-color: #F3F4F6;">
          <th style="text-align: left; padding: 8px; border: 1px solid #e5e7eb;">Metrik</th>
          <th style="text-align: right; padding: 8px; border: 1px solid #e5e7eb;">Nilai</th>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">Total Uang Masuk</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; color: #10B981; font-weight: bold;">${formatRupiah(totalIncome)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">Total Uang Keluar</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; color: #EF4444; font-weight: bold;">${formatRupiah(totalExpense)}</td>
        </tr>
        <tr style="background-color: #F8FAFC;">
          <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Saldo Bersih</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${formatRupiah(totalIncome - totalExpense)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">Total Simpanan Terpisah</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; color: #3B82F6; font-weight: bold;">${formatRupiah(totalSavings)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">Total Delivery Seluruh Waktu</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${totalDelivery} Paket</td>
        </tr>
      </table>
    </div>

    <div>
      <h2 style="color: #1E3A8A; font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 12px;">Ketentuan Bonus Aktif</h2>
      <table style="width: 100%; border-collapse: collapse; text-align: center;">
        <tr style="background-color: #F3F4F6;">
          <th style="padding: 8px; border: 1px solid #e5e7eb;">Kategori Target</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb;">Ketentuan</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb;">Tarif Bonus</th>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">Target 1</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">&ge; 2500 paket</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${formatRupiah(appUser.rate2500)} / paket</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">Target 2</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">&ge; 3500 paket</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${formatRupiah(appUser.rate3500)} / paket</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">⚡ Bonus Petir</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">Tanggal 21 - 20 berikutnya</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${formatRupiah(appUser.ratePetir)} / paket</td>
        </tr>
      </table>
    </div>

    <div style="margin-top: 50px; text-align: center; color: #888; font-size: 10px; border-top: 1px dashed #ccc; padding-top: 10px;">
      Dokumen ini sah dicetak secara otomatis dari Aplikasi Keuangan Kurir.
    </div>
  `;
  
  // Jalankan html2pdf
  const opt = {
    margin:       10,
    filename:     `Laporan_Keuangan_Kurir_${appUser.name}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  html2pdf().from(reportEl).set(opt).save().then(() => {
    showToast("PDF berhasil diunduh!", "success");
  }).catch(err => {
    console.error(err);
    showToast("Gagal mengunduh PDF", "error");
  });
}

// Reset Database Data (Kosongkan seluruh data simulasi)
async function resetAppDatabase() {
  const confirmReset = confirm("PERINGATAN! Langkah ini akan menghapus semua catatan pemasukan, pengeluaran, simpanan, dan performa harian Anda. Tindakan ini tidak dapat dibatalkan.\n\nApakah Anda yakin ingin menghapus semua data?");
  
  if (confirmReset) {
    try {
      // Jalankan transaksi pembersihan data
      await db.transaction('rw', [db.income, db.expense, db.savings, db.deliveries, db.settings], async () => {
        await db.income.clear();
        await db.expense.clear();
        await db.savings.clear();
        await db.deliveries.clear();
        
        // Tetapkan flag seeded agar mock data tidak dibuat kembali setelah reload
        await db.settings.put({ key: 'seeded', value: true });
      });
      
      showToast("Semua data berhasil dikosongkan!", "success");
      
      // Hitung ulang untuk mereset dashboard & grafik ke Rp0
      await recalculateEverything();
      
      // Pindahkan user ke dashboard yang bersih
      switchTab('dashboard');
    } catch (err) {
      console.error("Gagal melakukan reset database:", err);
      showToast("Gagal menghapus data", "error");
    }
  }
}

// Mengisi kembali data simulasi mock untuk uji coba
async function fillMockDatabase() {
  const confirmFill = confirm("Apakah Anda ingin mengisi database dengan data simulasi (mock data) selama 35 hari untuk mencoba seluruh grafik dan perhitungan bonus?");
  
  if (confirmFill) {
    try {
      showToast("Mengisi data simulasi...", "info");
      
      // Hapus data lama agar bersih sebelum disisipi mock data
      await db.transaction('rw', [db.income, db.expense, db.savings, db.deliveries, db.settings], async () => {
        await db.income.clear();
        await db.expense.clear();
        await db.savings.clear();
        await db.deliveries.clear();
        
        const today = new Date();
        
        // Seed Pemasukan
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

        // Seed Pengeluaran
        const de1 = new Date(); de1.setDate(today.getDate() - 12);
        const de2 = new Date(); de2.setDate(today.getDate() - 8);
        const de3 = new Date(); de3.setDate(today.getDate() - 3);
        await db.expense.bulkAdd([
          { date: de1.toISOString().substring(0, 10), nominal: 450000, keterangan: 'Servis Motor Rutin' },
          { date: de2.toISOString().substring(0, 10), nominal: 120000, keterangan: 'Beli Pertamax & Oli' },
          { date: de3.toISOString().substring(0, 10), nominal: 65000, keterangan: 'Makan Siang Kurir' }
        ]);

        // Seed Simpanan
        const ds1 = new Date(); ds1.setDate(today.getDate() - 14);
        const ds2 = new Date(); ds2.setDate(today.getDate() - 7);
        await db.savings.bulkAdd([
          { date: ds1.toISOString().substring(0, 10), nominal: 150000, keterangan: 'Tabungan Mudik Lebaran' },
          { date: ds2.toISOString().substring(0, 10), nominal: 150000, keterangan: 'Tabungan Wajib Mingguan' }
        ]);

        // Seed Deliveries (35 Hari Terakhir)
        const mockDeliveries = [];
        for (let i = 35; i >= 0; i--) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          const dateStr = d.toISOString().substring(0, 10);
          const count = Math.floor(Math.random() * 50) + 45;
          mockDeliveries.push({
            date: dateStr,
            jumlah: count
          });
        }
        await db.deliveries.bulkAdd(mockDeliveries);
        
        // Tetapkan flag seeded
        await db.settings.put({ key: 'seeded', value: true });
      });
      
      showToast("Data simulasi berhasil diisi!", "success");
      
      // Update UI & Alihkan ke Dashboard
      await recalculateEverything();
      switchTab('dashboard');
    } catch (err) {
      console.error("Gagal menyisipkan mock data:", err);
      showToast("Gagal mengisi data simulasi", "error");
    }
  }
}


