import Dexie from 'dexie';

export const db = new Dexie('NikahFundDB');
db.version(1).stores({
  locations: 'id, name, createdAt',
  transactions: 'id, type, date, fromLocationId, toLocationId, category, createdAt',
  auditLogs: 'id, createdAt, entityType, entityId, action',
  settings: 'key'
});

export const uid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
export async function audit(action, entityType, entityId, detail = {}) {
  await db.auditLogs.add({ id: uid(), createdAt: nowIso(), action, entityType, entityId, detail });
}
export async function seedIfEmpty() {
  if (await db.locations.count()) return;
  const time = nowIso();
  await db.transaction('rw', db.locations, db.settings, db.auditLogs, async () => {
    await db.locations.bulkAdd([
      { id: uid(), name: 'BCA Tahapan', kind: 'Rekening bank', createdAt: time },
      { id: uid(), name: 'GoPay', kind: 'Dompet digital', createdAt: time },
      { id: uid(), name: 'Tunai', kind: 'Uang tunai', createdAt: time }
    ]);
    await db.settings.bulkPut([
      { key: 'profileName', value: 'Kamu' },
      { key: 'targetAmount', value: 150000000 },
      { key: 'targetDate', value: '2027-06-12' },
      { key: 'monthlyTarget', value: 10937500 },
      { key: 'schemaVersion', value: 1 }
    ]);
    await db.auditLogs.add({ id: uid(), createdAt: time, action: 'INISIALISASI', entityType: 'app', entityId: 'local', detail: { note: 'Database lokal dibuat' } });
  });
}
export async function getSettings() {
  const rows = await db.settings.toArray();
  return Object.fromEntries(rows.map(x => [x.key, x.value]));
}
export async function setSetting(key, value) {
  await db.settings.put({ key, value });
  await audit('PENGATURAN_DIUBAH', 'setting', key, { key });
}
export async function calculateBalances() {
  const [locations, transactions] = await Promise.all([db.locations.toArray(), db.transactions.toArray()]);
  const balances = Object.fromEntries(locations.map(l => [l.id, 0]));
  for (const tx of transactions) {
    if (tx.type === 'deposit' && tx.toLocationId in balances) balances[tx.toLocationId] += tx.amount;
    if (tx.type === 'expense' && tx.fromLocationId in balances) balances[tx.fromLocationId] -= tx.amount;
    if (tx.type === 'transfer') {
      if (tx.fromLocationId in balances) balances[tx.fromLocationId] -= tx.amount;
      if (tx.toLocationId in balances) balances[tx.toLocationId] += tx.amount;
    }
  }
  return { locations, transactions, balances };
}
