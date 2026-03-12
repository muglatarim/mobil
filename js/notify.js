/**
 * notify.js - Bildirim ve uyarı sistemi
 */

let notificationPermission = 'default';

// Bildirim izni iste
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') {
    notificationPermission = 'granted';
    return true;
  }
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    notificationPermission = perm;
    return perm === 'granted';
  }
  return false;
}

// Browser bildirimi gönder
export function sendNotification(title, body, icon = './icons/icon-192.png') {
  if (notificationPermission === 'granted' && document.hidden) {
    new Notification(title, { body, icon, badge: icon, tag: 'karantina-uyari' });
  }
}

// Toast mesajı göster  
export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Karantina uyarı banner'ı
let activeAlerts = new Set();

export function showKarantinaAlert(mahalle, ilce, kisitlamalar) {
  const alertKey = `${mahalle}|${ilce}`;
  if (activeAlerts.has(alertKey)) return;
  activeAlerts.add(alertKey);

  const banner = document.getElementById('alert-banner');
  if (!banner) return;

  const enAgir = kisitlamalar.find(k => k.kisitlamaTipi?.includes('Koruma'));
  const tipClass = enAgir ? 'danger' : 'warning';
  const tipIcon = enAgir ? '🚨' : '⚠️';
  const tipText = enAgir ? 'KORUMA BÖLGESİ' : 'GÖZETİM BÖLGESİ';
  const hastalıklar = [...new Set(kisitlamalar.map(k => k.hastalik))].join(', ');

  const card = document.createElement('div');
  card.className = `alert-card ${enAgir ? '' : 'warning'}`;
  card.dataset.alertKey = alertKey;
  card.innerHTML = `
    <div class="alert-header">
      <span class="alert-icon">${tipIcon}</span>
      <span class="alert-title">KARANTİNA UYARISI – ${tipText}</span>
      <button class="alert-close" onclick="this.closest('.alert-card').remove()">&times;</button>
    </div>
    <div class="alert-body">
      <strong>${mahalle}</strong> mahallesine girdiniz.<br>
      Bu mahalle <strong>${kisitlamalar[0]?.kisitlamaTipi || 'Karantina'}</strong> kapsamındadır.<br>
      <span style="color:#94a3b8">Hastalık: ${hastalıklar}</span>
    </div>
  `;
  banner.appendChild(card);

  // Browser bildirimi
  sendNotification(
    `⚠️ Karantina Bölgesi: ${mahalle}`,
    `${tipText} bölgesine girdiniz. Hastalık: ${hastalıklar}`
  );

  // 30 sn sonra otomatik kapat
  setTimeout(() => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(-8px)';
    card.style.transition = 'all 0.4s ease';
    setTimeout(() => {
      card.remove();
      activeAlerts.delete(alertKey);
    }, 400);
  }, 30000);
}

export function clearAlerts() {
  const banner = document.getElementById('alert-banner');
  if (banner) banner.innerHTML = '';
  activeAlerts.clear();
}
