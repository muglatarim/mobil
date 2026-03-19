/**
 * notify.js - Bildirim ve uyarı sistemi
 * Service Worker üzerinden güçlü bildirim desteği
 */

let swRegistration = null;

// SW registration dışarıdan set edilir (app.js'den)
export function setSwRegistration(reg) {
  swRegistration = reg;
}

// Bildirim izni iste
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
}

// Bildirim durumunu döndür
export function getNotificationStatus() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'granted', 'denied', 'default'
}

/**
 * Bildirim gönder:
 * 1. Service Worker kayıtlıysa SW üzerinden göster (arka planda da çalışır)
 * 2. SW yoksa doğrudan Notification API
 */
export async function sendNotification(title, body, icon = './icons/icon-192.png') {
  if (Notification.permission !== 'granted') return;

  // SW üzerinden bildirim (uygulama minimize/arka planda iken de çalışır)
  if (swRegistration) {
    try {
      await swRegistration.showNotification(title, {
        body,
        icon,
        badge: icon,
        tag: 'karantina-uyari',
        requireInteraction: true,
        vibrate: [300, 100, 300, 100, 600],
        silent: false,
        renotify: true,
      });
      return;
    } catch (e) {
      console.warn('SW bildirim hatası, fallback:', e);
    }
  }

  // Fallback: doğrudan Notification
  new Notification(title, {
    body,
    icon,
    badge: icon,
    tag: 'karantina-uyari',
    requireInteraction: true,
    silent: false,
  });
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
  const tipIcon = enAgir ? '🚨' : '⚠️';
  const tipText = enAgir ? 'KORUMA BÖLGESİ' : 'GÖZETİM BÖLGESİ';
  const hastaliklar = [...new Set(kisitlamalar.map(k => k.hastalik))].join(', ');

  const card = document.createElement('div');
  card.className = `alert-card ${enAgir ? '' : 'warning'}`;
  card.dataset.alertKey = alertKey;
  card.innerHTML = `
    <div class="alert-header">
      <span class="alert-icon">${tipIcon}</span>
      <span class="alert-title">KARANTİNA – ${tipText}</span>
      <button class="alert-close" onclick="this.closest('.alert-card').remove()">×</button>
    </div>
    <div class="alert-body">
      <strong>${mahalle}</strong> mahallesine girdiniz.<br>
      <strong>${kisitlamalar[0]?.kisitlamaTipi || 'Karantina'}</strong> kapsamında.<br>
      <span style="color:#94a3b8">Hastalık: ${hastaliklar}</span>
    </div>
  `;
  banner.appendChild(card);

  // SW üzerinden bildirim (arka planda bile çalışır)
  sendNotification(
    `${tipIcon} Karantina: ${mahalle}`,
    `${tipText} bölgesine girdiniz. Hastalık: ${hastaliklar}`
  );

  // SW'ye de mesaj gönder (uygulama minimize da olsa bildirim gitsin)
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'KARANTINA_ALERT',
      mahalle,
      ilce,
      kisitlamaTipi: tipText,
      hastalik: hastaliklar,
    });
  }

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
