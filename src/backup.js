import { db } from './db';

const ITERATIONS = 310000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (str) => Uint8Array.from(atob(str), c => c.charCodeAt(0));

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function exportEncryptedBackup(password) {
  if (password.length < 12) throw new Error('Gunakan kata sandi minimal 12 karakter.');
  const payload = {
    app: 'NikahFund', formatVersion: 1, exportedAt: new Date().toISOString(),
    data: {
      locations: await db.locations.toArray(), transactions: await db.transactions.toArray(),
      auditLogs: await db.auditLogs.toArray(), settings: await db.settings.toArray()
    }
  };
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(payload)));
  return new Blob([JSON.stringify({
    app: 'NikahFund encrypted backup', formatVersion: 1, algorithm: 'AES-256-GCM', kdf: 'PBKDF2-SHA-256',
    iterations: ITERATIONS, salt: toB64(salt), iv: toB64(iv), ciphertext: toB64(encrypted)
  }, null, 2)], { type: 'application/json' });
}
export async function importEncryptedBackup(file, password) {
  const wrapper = JSON.parse(await file.text());
  if (wrapper.app !== 'NikahFund encrypted backup' || wrapper.formatVersion !== 1 || wrapper.algorithm !== 'AES-256-GCM') throw new Error('Format backup tidak dikenal.');
  const key = await deriveKey(password, fromB64(wrapper.salt));
  let plaintext;
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(wrapper.iv) }, key, fromB64(wrapper.ciphertext));
  } catch { throw new Error('Kata sandi salah atau file backup rusak.'); }
  const payload = JSON.parse(decoder.decode(plaintext));
  if (payload.app !== 'NikahFund' || payload.formatVersion !== 1 || !payload.data) throw new Error('Isi backup tidak valid.');
  const tables = ['locations', 'transactions', 'auditLogs', 'settings'];
  for (const table of tables) if (!Array.isArray(payload.data[table])) throw new Error(`Data ${table} tidak valid.`);
  // Validasi referensi dan nominal sebelum menyentuh data yang sekarang.
  const ids = new Set(payload.data.locations.map(x => x.id));
  for (const tx of payload.data.transactions) {
    if (!Number.isSafeInteger(tx.amount) || tx.amount <= 0) throw new Error('Backup berisi nominal transaksi tidak valid.');
    if (tx.type === 'deposit' && !ids.has(tx.toLocationId)) throw new Error('Lokasi tujuan transaksi tidak ditemukan.');
    if (tx.type === 'expense' && !ids.has(tx.fromLocationId)) throw new Error('Lokasi sumber transaksi tidak ditemukan.');
    if (tx.type === 'transfer' && (!ids.has(tx.fromLocationId) || !ids.has(tx.toLocationId) || tx.fromLocationId === tx.toLocationId)) throw new Error('Referensi transfer tidak valid.');
    if (!['deposit', 'expense', 'transfer'].includes(tx.type)) throw new Error('Jenis transaksi tidak valid.');
  }
  await db.transaction('rw', db.locations, db.transactions, db.auditLogs, db.settings, async () => {
    await db.locations.clear(); await db.transactions.clear(); await db.auditLogs.clear(); await db.settings.clear();
    await db.locations.bulkPut(payload.data.locations); await db.transactions.bulkPut(payload.data.transactions);
    await db.auditLogs.bulkPut(payload.data.auditLogs); await db.settings.bulkPut(payload.data.settings);
    await db.auditLogs.add({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), action: 'RESTORE_BACKUP', entityType: 'backup', entityId: 'restore', detail: { exportedAt: payload.exportedAt } });
  });
  return payload.exportedAt;
}
