import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Home, ArrowLeftRight, Landmark, ScrollText, Plus, Download, Upload, Trash2, Wallet, ShieldCheck, Menu, X, Target, RefreshCw, Pencil, Heart, LockKeyhole, WifiOff } from 'lucide-react';
import { db, uid, nowIso, audit, seedIfEmpty, getSettings, setSetting, calculateBalances } from './db';
import { exportEncryptedBackup, importEncryptedBackup } from './backup';
import './style.css';

const money = n => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const dateNow = () => new Date().toLocaleDateString('en-CA');
const dateFmt = v => new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const nav = [{ id: 'home', label: 'Beranda', icon: Home }, { id: 'transactions', label: 'Transaksi', icon: ArrowLeftRight }, { id: 'locations', label: 'Lokasi dana', icon: Landmark }, { id: 'audit', label: 'Log audit', icon: ScrollText }, { id: 'settings', label: 'Backup', icon: ShieldCheck }];

function App() {
  const [ready, setReady] = useState(false); const [page, setPage] = useState('home'); const [drawer, setDrawer] = useState(false);
  const [data, setData] = useState({ locations: [], transactions: [], balances: {} }); const [settings, setSettingsState] = useState({}); const [logs, setLogs] = useState([]); const [toast, setToast] = useState('');
  const refresh = async () => { setData(await calculateBalances()); setSettingsState(await getSettings()); setLogs((await db.auditLogs.orderBy('createdAt').reverse().limit(100).toArray())); };
  useEffect(() => { (async () => { await seedIfEmpty(); await refresh(); setReady(true); })(); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); }, [toast]);
  const total = Object.values(data.balances).reduce((a, b) => a + b, 0);
  const goal = Number(settings.targetAmount || 150000000); const progress = goal > 0 ? Math.min(100, total / goal * 100) : 0;
  const sortedTx = useMemo(() => [...data.transactions].sort((a,b) => `${b.date} ${b.createdAt}`.localeCompare(`${a.date} ${a.createdAt}`)), [data.transactions]);
  const changePage = p => { setPage(p); setDrawer(false); };
  const addTx = async form => {
    const amount = Number(form.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Nominal harus berupa angka rupiah positif.');
    if (!form.date || Number.isNaN(Date.parse(form.date))) throw new Error('Tanggal tidak valid.');
    if (form.type === 'deposit' && !data.locations.some(x => x.id === form.toLocationId)) throw new Error('Pilih lokasi dana.');
    if (form.type === 'expense') {
      if (!data.locations.some(x => x.id === form.fromLocationId)) throw new Error('Pilih lokasi dana.');
      if ((data.balances[form.fromLocationId] || 0) < amount) throw new Error('Saldo lokasi dana tidak mencukupi.');
    }
    if (form.type === 'transfer') {
      if (!form.fromLocationId || !form.toLocationId || form.fromLocationId === form.toLocationId) throw new Error('Lokasi asal dan tujuan harus berbeda.');
      if ((data.balances[form.fromLocationId] || 0) < amount) throw new Error('Saldo lokasi asal tidak mencukupi.');
    }
    const row = { id: uid(), ...form, amount, createdAt: nowIso(), updatedAt: nowIso(), category: form.category || '', note: (form.note || '').trim(), person: (form.person || '').trim() };
    await db.transaction('rw', db.transactions, db.auditLogs, async () => {
      await db.transactions.add(row);
      await db.auditLogs.add({ id: uid(), createdAt: nowIso(), action: 'TRANSAKSI_DIBUAT', entityType: 'transaction', entityId: row.id, detail: { type: row.type, amount: row.amount, date: row.date } });
    });
    await refresh(); setToast('Transaksi berhasil disimpan di perangkat ini.'); setPage('transactions');
  };
  const addLocation = async (name, kind) => {
    const clean = name.trim(); if (!clean) throw new Error('Nama lokasi wajib diisi.');
    if (data.locations.some(l => l.name.toLowerCase() === clean.toLowerCase())) throw new Error('Nama lokasi sudah digunakan.');
    const loc = { id: uid(), name: clean, kind: kind || 'Lainnya', createdAt: nowIso() };
    await db.transaction('rw', db.locations, db.auditLogs, async () => { await db.locations.add(loc); await db.auditLogs.add({ id: uid(), createdAt: nowIso(), action: 'LOKASI_DANA_DITAMBAH', entityType: 'location', entityId: loc.id, detail: { name: loc.name } }); });
    await refresh(); setToast('Lokasi dana ditambahkan.');
  };
  const deleteTx = async tx => {
    if (!confirm('Hapus transaksi ini? Saldo akan dihitung ulang. Riwayat penghapusan akan dicatat.')) return;
    await db.transaction('rw', db.transactions, db.auditLogs, async () => { await db.transactions.delete(tx.id); await db.auditLogs.add({ id: uid(), createdAt: nowIso(), action: 'TRANSAKSI_DIHAPUS', entityType: 'transaction', entityId: tx.id, detail: { type: tx.type, amount: tx.amount, date: tx.date } }); });
    await refresh(); setToast('Transaksi dihapus.');
  };
  if (!ready) return <div className="loading"><div className="brand-mark">N</div><p>Menyiapkan NikahFund di perangkat ini…</p></div>;
  return <div className="app-shell">
    {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
    <aside className={`sidebar ${drawer ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark">N</div><div><b>NikahFund</b><small>Wedding Savings Tracker</small></div><button className="icon-button close-drawer" onClick={() => setDrawer(false)} aria-label="Tutup menu"><X size={20}/></button></div>
      <div className="private-tag"><ShieldCheck size={15}/> Data tersimpan di perangkat</div>
      <nav>{nav.map(item => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => changePage(item.id)}><item.icon size={19}/><span>{item.label}</span></button>)}</nav>
      <div className="sidebar-foot"><LockKeyhole size={15}/><span>Mode lokal · tanpa akun</span></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="icon-button menu-button" onClick={() => setDrawer(true)} aria-label="Buka menu"><Menu/></button><div><div className="eyebrow">RUANG TABUNGAN KITA</div><div className="top-title">{nav.find(x => x.id === page)?.label || 'NikahFund'}</div></div><div className="offline"><span/> Lokal</div></header>
      <div className="content">
        {page === 'home' && <HomePage settings={settings} total={total} goal={goal} progress={progress} data={data} tx={sortedTx} onPage={changePage} />}
        {page === 'transactions' && <TransactionsPage data={data} tx={sortedTx} onAdd={addTx} onDelete={deleteTx} toast={setToast} />}
        {page === 'locations' && <LocationsPage data={data} onAdd={addLocation} onRefresh={refresh} toast={setToast} />}
        {page === 'audit' && <AuditPage logs={logs} />}
        {page === 'settings' && <BackupPage refresh={refresh} toast={setToast} settings={settings} />}
      </div>
      <footer className="footer"><ShieldCheck size={14}/> Data transaksi tidak dikirim ke server <span>•</span> NikahFund</footer>
    </main>
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

function HomePage({ settings, total, goal, progress, data, tx, onPage }) {
  const remain = Math.max(0, goal - total);
  return <div className="page-stack">
    <section className="welcome"><div><p className="eyebrow">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h1>Pelan-pelan, <em>menuju hari kita.</em></h1><p>Setiap langkah kecil mendekatkan kita ke hari istimewa.</p></div><div className="heart-badge"><Heart size={24}/></div></section>
    <section className="hero-card"><div className="hero-top"><span><Wallet size={16}/> Dana terkumpul</span><span className="hero-chip">TABUNGAN BERSAMA</span></div><div className="hero-amount">{money(total)}</div><div className="progress-track"><div className="progress-value" style={{ width: `${progress}%` }}/></div><div className="progress-meta"><span>{progress.toFixed(1)}% dari target</span><span>Sisa {money(remain)}</span></div><div className="hero-bottom"><div><small>Target pernikahan</small><b>{money(goal)}</b></div><div className="hero-divider"/><div><small>Target tanggal</small><b>{settings.targetDate ? dateFmt(`${settings.targetDate}T00:00:00`) : 'Belum diatur'}</b></div></div></section>
    <section className="stat-grid"><div className="stat-card"><div className="stat-icon green"><Landmark size={18}/></div><span>Lokasi dana</span><b>{data.locations.length} <small>lokasi</small></b></div><div className="stat-card"><div className="stat-icon sand"><ArrowLeftRight size={18}/></div><span>Total transaksi</span><b>{tx.length} <small>catatan</small></b></div></section>
    <div className="section-heading"><div><h2>Lokasi dana</h2><p>Saldo dari semua tempat penyimpanan</p></div><button className="text-button" onClick={() => onPage('locations')}>Lihat semua <span>→</span></button></div>
    <div className="location-list">{data.locations.map(l => <div className="location-row" key={l.id}><div className="location-symbol"><Landmark size={18}/></div><div className="location-name"><b>{l.name}</b><small>{l.kind}</small></div><strong>{money(data.balances[l.id] || 0)}</strong></div>)}</div>
    <div className="section-heading"><div><h2>Transaksi terakhir</h2><p>Pergerakan dana terbaru</p></div><button className="text-button" onClick={() => onPage('transactions')}>Lihat semua <span>→</span></button></div>
    <TransactionList tx={tx.slice(0, 5)} locations={data.locations} onDelete={null}/>
    <div className="tip-card"><div className="tip-icon"><ShieldCheck size={19}/></div><div><b>Tabunganmu bersifat lokal</b><p>Data hanya tersimpan di browser HP ini. Buat backup terenkripsi secara berkala.</p><button className="text-button" onClick={() => onPage('settings')}>Atur backup <span>→</span></button></div></div>
  </div>;
}

function TransactionsPage({ data, tx, onAdd, onDelete }) {
  const [type, setType] = useState('deposit'); const [amount, setAmount] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [date, setDate] = useState(dateNow()); const [category, setCategory] = useState('Tabungan rutin'); const [person, setPerson] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState('');
  useEffect(() => { if (!from && data.locations[0]) setFrom(data.locations[0].id); if (!to && data.locations[1]) setTo(data.locations[1].id); }, [data.locations]);
  const categories = type === 'expense' ? ['Katering','Venue','Cincin','Busana','Dokumentasi','Honeymoon','DP / uang muka','Lainnya'] : ['Tabungan rutin','Bonus','Hadiah','Pengembalian','Lainnya'];
  const submit = async e => { e.preventDefault(); setErr(''); try { await onAdd({ type, amount, date, category: type === 'transfer' ? 'Transfer antar lokasi' : category, person, note, fromLocationId: type === 'deposit' ? '' : from, toLocationId: type === 'deposit' ? to : type === 'transfer' ? to : '' }); setAmount(''); setNote(''); setPerson(''); } catch (e) { setErr(e.message || 'Transaksi gagal disimpan.'); } };
  const fmtType = t => t === 'deposit' ? 'Setoran' : t === 'expense' ? 'Pengeluaran' : 'Transfer';
  return <div className="page-stack"><section className="page-intro"><p className="eyebrow">CATAT DENGAN RAPI</p><h1>Transaksi</h1><p>Semua catatan disimpan di perangkat ini.</p></section>
    <div className="panel form-panel"><div className="segmented">{[['deposit','Setoran'],['expense','Pengeluaran'],['transfer','Transfer']].map(([v,l]) => <button key={v} className={type === v ? 'selected' : ''} onClick={() => { setType(v); setCategory(v === 'expense' ? 'Katering' : 'Tabungan rutin'); }}>{l}</button>)}</div>
      <form onSubmit={submit} className="form-grid"><Field label="Jumlah (Rp)"><input required inputMode="numeric" type="number" min="1" step="1" placeholder="Contoh: 500000" value={amount} onChange={e => setAmount(e.target.value)}/></Field>
        {type !== 'deposit' && <Field label={type === 'expense' ? 'Dibayar dari' : 'Dari'}><select value={from} onChange={e => setFrom(e.target.value)} required>{data.locations.map(l => <option value={l.id} key={l.id}>{l.name} — {money(data.balances[l.id] || 0)}</option>)}</select></Field>}
        {type !== 'expense' && <Field label={type === 'transfer' ? 'Ke lokasi' : 'Masuk ke lokasi'}><select value={to} onChange={e => setTo(e.target.value)} required>{data.locations.map(l => <option value={l.id} key={l.id} disabled={type === 'transfer' && l.id === from}>{l.name}</option>)}</select></Field>}
        {type !== 'transfer' && <Field label="Kategori"><select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></Field>}
        <Field label={type === 'expense' ? 'Dibayar oleh' : type === 'transfer' ? 'Ditransfer oleh' : 'Disetor oleh'}><input value={person} onChange={e => setPerson(e.target.value)} placeholder="Nama (opsional)"/></Field>
        <Field label="Tanggal"><input required type="date" value={date} onChange={e => setDate(e.target.value)}/></Field>
        <Field label="Catatan" full><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Tambahkan keterangan (opsional)" rows="2" maxLength="500"/></Field>
        {err && <div className="error-message" role="alert">{err}</div>}
        {type === 'transfer' && <p className="form-hint full">Transfer hanya memindahkan saldo antar lokasi. Total tabungan tidak berubah.</p>}
        <button className="primary-button full" type="submit"><Plus size={17}/> Simpan {fmtType(type).toLowerCase()}</button>
      </form>
    </div>
    <div className="section-heading"><div><h2>Riwayat transaksi</h2><p>{tx.length} catatan tersimpan</p></div></div>
    <TransactionList tx={tx} locations={data.locations} onDelete={onDelete}/>
  </div>;
}

function TransactionList({ tx, locations, onDelete }) {
  const locName = id => locations.find(l => l.id === id)?.name || 'Lokasi dihapus';
  if (!tx.length) return <div className="empty-state"><ArrowLeftRight size={25}/><b>Belum ada transaksi</b><p>Tambahkan setoran pertama untuk mulai mencatat tabungan.</p></div>;
  return <div className="transaction-list">{tx.map(t => { const transfer = t.type === 'transfer'; const positive = t.type === 'deposit'; const title = transfer ? `${locName(t.fromLocationId)} → ${locName(t.toLocationId)}` : t.category || (positive ? 'Setoran' : 'Pengeluaran'); return <div className="transaction-row" key={t.id}><div className={`tx-icon ${positive ? 'tx-positive' : transfer ? 'tx-transfer' : 'tx-negative'}`}>{positive ? <Plus size={17}/> : transfer ? <ArrowLeftRight size={17}/> : <span>−</span>}</div><div className="tx-main"><b>{title}</b><small>{transfer ? 'Transfer antar lokasi' : `${locName(positive ? t.toLocationId : t.fromLocationId)}${t.person ? ` · ${t.person}` : ''}`}</small><small>{dateFmt(`${t.date}T00:00:00`)}{t.note ? ` · ${t.note}` : ''}</small></div><div className="tx-amount"><b className={positive ? 'amount-positive' : transfer ? 'amount-neutral' : 'amount-negative'}>{positive ? '+' : transfer ? '↔ ' : '−'}{money(t.amount)}</b>{onDelete && <button className="mini-delete" onClick={() => onDelete(t)} aria-label="Hapus transaksi"><Trash2 size={14}/></button>}</div></div>; })}</div>;
}

function LocationsPage({ data, onAdd, toast }) {
  const [show, setShow] = useState(false); const [name, setName] = useState(''); const [kind, setKind] = useState('Rekening bank'); const [err, setErr] = useState('');
  const submit = async e => { e.preventDefault(); setErr(''); try { await onAdd(name, kind); setName(''); setShow(false); } catch (e) { setErr(e.message); } };
  const total = Object.values(data.balances).reduce((a,b) => a+b,0);
  return <div className="page-stack"><section className="page-intro"><p className="eyebrow">TEMPAT PENYIMPANAN</p><h1>Lokasi dana</h1><p>Saldo dihitung otomatis berdasarkan transaksi.</p></section>
    <div className="total-strip"><span>Total seluruh lokasi</span><b>{money(total)}</b></div>
    <div className="location-list spacious">{data.locations.map(l => <div className="location-row" key={l.id}><div className="location-symbol"><Landmark size={19}/></div><div className="location-name"><b>{l.name}</b><small>{l.kind}</small></div><strong>{money(data.balances[l.id] || 0)}</strong></div>)}</div>
    <div className="button-row"><button className="primary-button" onClick={() => setShow(!show)}><Plus size={17}/> Tambah lokasi</button><div className="form-hint inline-hint">Transfer antar lokasi tidak mengubah total tabungan.</div></div>
    {show && <div className="panel"><h2>Lokasi baru</h2><form className="form-grid" onSubmit={submit}><Field label="Nama lokasi" full><input value={name} onChange={e => setName(e.target.value)} required maxLength="60" placeholder="Contoh: Rekening BRI"/></Field><Field label="Jenis lokasi" full><select value={kind} onChange={e => setKind(e.target.value)}><option>Rekening bank</option><option>Dompet digital</option><option>Uang tunai</option><option>Deposito</option><option>Lainnya</option></select></Field>{err && <div className="error-message full">{err}</div>}<button className="primary-button full">Simpan lokasi</button></form></div>}
  </div>;
}

function AuditPage({ logs }) {
  const label = a => ({ TRANSAKSI_DIBUAT: 'Transaksi dibuat', TRANSAKSI_DIHAPUS: 'Transaksi dihapus', LOKASI_DANA_DITAMBAH: 'Lokasi dana ditambahkan', PENGATURAN_DIUBAH: 'Pengaturan diubah', RESTORE_BACKUP: 'Backup dipulihkan', INISIALISASI: 'Database lokal dibuat' }[a] || a.replaceAll('_',' ').toLowerCase());
  return <div className="page-stack"><section className="page-intro"><p className="eyebrow">RIWAYAT PERUBAHAN</p><h1>Log audit</h1><p>Catatan aktivitas lokal, hanya untuk membantu pelacakan.</p></section><div className="notice"><ShieldCheck size={18}/><p>Log audit ini tersimpan di perangkat yang sama dan dapat diubah oleh orang yang memiliki akses ke browser. Ini bukan bukti audit yang tahan manipulasi.</p></div><div className="audit-list">{logs.map(log => <div className="audit-row" key={log.id}><div className="audit-dot"/><div className="audit-content"><b>{label(log.action)}</b><small>{new Date(log.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</small><p>{log.detail?.amount ? `${money(log.detail.amount)} · ` : ''}{log.detail?.name || log.detail?.key || log.detail?.note || log.entityType}</p></div></div>)}{!logs.length && <div className="empty-state">Belum ada aktivitas.</div>}</div></div>;
}

function BackupPage({ refresh, toast, settings }) {
  const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [file, setFile] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [goal, setGoal] = useState(String(settings.targetAmount || 150000000)); const [targetDate, setTargetDate] = useState(settings.targetDate || '2027-06-12');
  useEffect(() => { setGoal(String(settings.targetAmount || 150000000)); setTargetDate(settings.targetDate || '2027-06-12'); }, [settings.targetAmount, settings.targetDate]);
  const exportBackup = async () => { setErr(''); if (password !== confirmPassword) { setErr('Konfirmasi kata sandi tidak cocok.'); return; } setBusy(true); try { const blob = await exportEncryptedBackup(password); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `NikahFund-backup-${dateNow()}.nikahfund.json`; a.click(); URL.revokeObjectURL(url); toast('Backup terenkripsi berhasil dibuat. Simpan di tempat aman.'); } catch(e) { setErr(e.message); } finally { setBusy(false); } };
  const restore = async () => { if (!file) { setErr('Pilih file backup terlebih dahulu.'); return; } if (!confirm('Restore akan MENGGANTI semua data NikahFund saat ini dengan isi backup. Buat backup kondisi sekarang jika masih dibutuhkan. Lanjutkan?')) return; setErr(''); setBusy(true); try { const exportedAt = await importEncryptedBackup(file, password); await refresh(); setFile(null); toast(`Backup dari ${new Date(exportedAt).toLocaleDateString('id-ID')} berhasil dipulihkan.`); } catch(e) { setErr(e.message || 'Restore gagal.'); } finally { setBusy(false); } };
  const saveGoal = async e => { e.preventDefault(); const amount = Number(goal); if (!Number.isSafeInteger(amount) || amount <= 0) { setErr('Target harus berupa nominal rupiah positif.'); return; } await setSetting('targetAmount', amount); await setSetting('targetDate', targetDate); await refresh(); toast('Target tabungan diperbarui.'); };
  return <div className="page-stack"><section className="page-intro"><p className="eyebrow">KENDALI DATA PRIBADI</p><h1>Backup & pengaturan</h1><p>Data utama tetap berada di penyimpanan lokal browser.</p></section>
    <div className="notice"><LockKeyhole size={19}/><p><b>Backup dilindungi kata sandi.</b> Enkripsi AES-256-GCM dengan kunci turunan PBKDF2. Kata sandi tidak disimpan oleh aplikasi. Jika lupa kata sandi, backup tidak dapat dibuka.</p></div>
    <section className="panel"><div className="panel-heading"><div className="panel-icon"><Download size={19}/></div><div><h2>Buat backup terenkripsi</h2><p>Ekspor semua lokasi, transaksi, pengaturan, dan log audit.</p></div></div><div className="form-grid"><Field label="Kata sandi backup" full><input type="password" autoComplete="new-password" minLength="12" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimal 12 karakter"/></Field><Field label="Konfirmasi kata sandi" full><input type="password" autoComplete="new-password" minLength="12" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Ulangi kata sandi yang sama"/></Field><button className="primary-button full" disabled={busy || password.length < 12 || password !== confirmPassword} onClick={exportBackup}><Download size={17}/>{busy ? 'Memproses…' : 'Ekspor backup terenkripsi'}</button></div></section>
    <section className="panel"><div className="panel-heading"><div className="panel-icon sand"><Upload size={19}/></div><div><h2>Pulihkan backup</h2><p>File backup yang valid akan menggantikan seluruh data lokal.</p></div></div><div className="form-grid"><Field label="File backup (.json)" full><input type="file" accept=".json,application/json" onChange={e => setFile(e.target.files?.[0] || null)}/></Field><Field label="Kata sandi backup" full><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Masukkan kata sandi backup"/></Field><button className="secondary-button full" disabled={busy || !file || !password} onClick={restore}><RefreshCw size={17}/>{busy ? 'Memproses…' : 'Validasi & pulihkan backup'}</button></div></section>
    <section className="panel"><div className="panel-heading"><div className="panel-icon"><Target size={19}/></div><div><h2>Target pernikahan</h2><p>Sesuaikan target dan tanggal rencana.</p></div></div><form className="form-grid" onSubmit={saveGoal}><Field label="Target tabungan (Rp)" full><input type="number" min="1" step="1" required value={goal} onChange={e => setGoal(e.target.value)}/></Field><Field label="Tanggal target" full><input type="date" required value={targetDate} onChange={e => setTargetDate(e.target.value)}/></Field><button className="primary-button full">Simpan target</button></form></section>
    {err && <div className="error-message" role="alert">{err}</div>}
    <div className="backup-reminder"><ShieldCheck size={18}/><p><b>Saran keamanan</b><br/>Simpan salinan backup di media lain yang aman, misalnya komputer pribadi atau USB terenkripsi. Jangan hanya menyimpannya di HP yang sama.</p></div>
  </div>;
}
function Field({ label, children, full }) { return <label className={`field ${full ? 'full' : ''}`}><span>{label}</span>{children}</label>; }

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
