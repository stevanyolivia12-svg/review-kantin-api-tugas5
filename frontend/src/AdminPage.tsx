import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, createAuditLog, createManagedUser, listAuditLogs, listFlags, listUsers, updateFlag } from './api';
import { useAuth } from './auth';
import type { AuditLog, Flag, ManagedUser } from './types';

type AdminTab = 'users' | 'flags' | 'logs';

export function AdminPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([listUsers(token), listFlags(token), listAuditLogs(token)])
      .then(([userRows, flagRows, logRows]) => {
        if (!active) return;
        setUsers(userRows);
        setFlags(flagRows);
        setLogs(logRows);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) setError('Sesi berakhir. Masuk kembali sebagai admin.');
        else if (reason instanceof ApiError && reason.status === 403) setError('Halaman ini hanya dapat diakses admin.');
        else setError(reason instanceof Error ? reason.message : 'Data admin gagal dimuat.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload, token]);

  async function changeFlag(flag: Flag, status: Flag['status']) {
    if (!token) return;
    setError(null);
    try {
      await updateFlag(flag.id, status, token);
      setNotice(`Laporan #${flag.id} diperbarui.`);
      setReload((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Status laporan gagal diperbarui.');
    }
  }

  return (
    <div className="page-wrap admin-page">
      <section className="admin-hero">
        <span className="eyebrow">RUANG KERJA ADMIN</span>
        <h1>Semua data,<br /><em>satu tempat.</em></h1>
        <p>Kelola akun, moderasi laporan, dan lihat aktivitas yang tersimpan di database.</p>
        <div className="admin-stats">
          <div><strong>{users.length}</strong><span>AKUN</span></div>
          <div><strong>{flags.filter((flag) => flag.status === 'pending').length}</strong><span>LAPORAN AKTIF</span></div>
          <div><strong>{logs.length}</strong><span>LOG AKTIVITAS</span></div>
        </div>
      </section>

      <section className="admin-content">
        <div className="admin-tabs" role="tablist" aria-label="Menu admin">
          <button role="tab" aria-selected={tab === 'users'} className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Pengguna</button>
          <button role="tab" aria-selected={tab === 'flags'} className={tab === 'flags' ? 'active' : ''} onClick={() => setTab('flags')}>Moderasi</button>
          <button role="tab" aria-selected={tab === 'logs'} className={tab === 'logs' ? 'active' : ''} onClick={() => setTab('logs')}>Audit log</button>
        </div>
        {notice && <p className="success-message" role="status">{notice}</p>}
        {error && <div className="inline-error" role="alert"><span>{error}</span><button className="button button-light" onClick={() => setReload((value) => value + 1)}>Coba lagi</button></div>}
        {loading ? <div className="loading-grid"><div className="skeleton-card"><div /><span /></div></div> : !error && (
          <>
            {tab === 'users' && <UsersPanel users={users} token={token!} onCreated={(user) => {
              setUsers((current) => [...current, user]);
              setNotice(`Akun ${user.email} berhasil dibuat.`);
            }} onError={setError} />}
            {tab === 'flags' && <FlagsPanel flags={flags} onChange={changeFlag} />}
            {tab === 'logs' && <LogsPanel logs={logs} token={token!} onCreated={(log) => {
              setLogs((current) => [...current, log]);
              setNotice('Audit log berhasil dicatat.');
            }} onError={setError} />}
          </>
        )}
      </section>
    </div>
  );
}

function UsersPanel({
  users,
  token,
  onCreated,
  onError,
}: {
  users: ManagedUser[];
  token: string;
  onCreated: (user: ManagedUser) => void;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<ManagedUser['role']>('owner');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    onError(null);
    try {
      const user = await createManagedUser({ name, email, password, role }, token);
      setName('');
      setEmail('');
      setPassword('');
      onCreated(user);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Akun tidak dapat dibuat.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="admin-section-heading"><div><span className="eyebrow">AKSES PLATFORM</span><h2>Pengguna</h2></div><span>{users.length} akun terdaftar</span></div>
      <form className="admin-create-form panel" onSubmit={submit}>
        <h3>Buat akun staff</h3>
        <p className="muted">Buat akun dengan peran yang sesuai. Hak akses tetap dikendalikan backend.</p>
        <div className="admin-form-grid">
          <label className="field">Nama<input value={name} onChange={(event) => setName(event.target.value)} minLength={3} maxLength={100} required /></label>
          <label className="field">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={150} required /></label>
          <label className="field">Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} required /></label>
          <label className="field">Role<select value={role} onChange={(event) => setRole(event.target.value as ManagedUser['role'])}><option value="owner">Owner</option><option value="customer">Customer</option><option value="admin">Admin</option></select></label>
        </div>
        <button className="button button-dark" disabled={busy}>{busy ? 'Membuat…' : '＋ Buat pengguna'}</button>
      </form>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Dibuat</th></tr></thead><tbody>
        {users.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td><span className={`role-badge role-${user.role}`}>{user.role}</span></td><td>{formatDate(user.createdAt)}</td></tr>)}
      </tbody></table></div>
    </>
  );
}

function FlagsPanel({ flags, onChange }: { flags: Flag[]; onChange: (flag: Flag, status: Flag['status']) => void }) {
  const [filter, setFilter] = useState('all');
  const visible = filter === 'all' ? flags : flags.filter((flag) => flag.status === filter);
  return (
    <>
      <div className="admin-section-heading"><div><span className="eyebrow">LAPORAN KOMUNITAS</span><h2>Moderasi ulasan</h2></div>
        <select aria-label="Filter status laporan" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Semua status</option><option value="pending">Pending</option><option value="resolved">Selesai</option><option value="dismissed">Ditolak</option></select>
      </div>
      {visible.length === 0 ? <div className="empty-state"><span className="empty-icon">✓</span><h3>Tidak ada laporan.</h3><p>Laporan yang masuk akan tampil di sini.</p></div> : (
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Laporan</th><th>Ulasan</th><th>Pelapor</th><th>Alasan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
          {visible.map((flag) => <tr key={flag.id}><td>#{flag.id}</td><td>#{flag.reviewId}</td><td>#{flag.reportedBy}</td><td>{flag.reason || 'Tanpa alasan'}</td><td><span className={`flag-badge flag-${flag.status}`}>{flag.status}</span></td><td>
            <div className="table-actions"><button className="button button-quiet" onClick={() => onChange(flag, 'resolved')} disabled={flag.status === 'resolved'}>Selesaikan</button><button className="button button-quiet danger-text" onClick={() => onChange(flag, 'dismissed')} disabled={flag.status === 'dismissed'}>Tolak</button></div>
          </td></tr>)}
        </tbody></table></div>
      )}
    </>
  );
}

function LogsPanel({
  logs,
  token,
  onCreated,
  onError,
}: {
  logs: AuditLog[];
  token: string;
  onCreated: (log: AuditLog) => void;
  onError: (message: string | null) => void;
}) {
  const [action, setAction] = useState('');
  const [targetTable, setTargetTable] = useState('STALLS');
  const [targetId, setTargetId] = useState('');
  const [metadata, setMetadata] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    onError(null);
    try {
      const log = await createAuditLog({
        action: action.trim(),
        targetTable,
        targetId: Number(targetId),
        metadata: metadata.trim() || null,
      }, token);
      setAction('');
      setTargetId('');
      setMetadata('');
      onCreated(log);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Audit log tidak dapat disimpan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="admin-section-heading"><div><span className="eyebrow">CATATAN SISTEM</span><h2>Audit log</h2></div><span>{logs.length} catatan</span></div>
      <form className="admin-create-form panel" onSubmit={submit}>
        <h3>Catat aktivitas</h3>
        <div className="admin-form-grid">
          <label className="field">Aksi<input value={action} onChange={(event) => setAction(event.target.value)} maxLength={50} required placeholder="Contoh: REVIEW_MODERATED" /></label>
          <label className="field">Tabel<input value={targetTable} onChange={(event) => setTargetTable(event.target.value)} maxLength={50} required /></label>
          <label className="field">ID data<input type="number" value={targetId} onChange={(event) => setTargetId(event.target.value)} min="1" step="1" required /></label>
          <label className="field">Metadata<input value={metadata} onChange={(event) => setMetadata(event.target.value)} maxLength={4000} /></label>
        </div>
        <button className="button button-dark" disabled={busy}>{busy ? 'Menyimpan…' : '＋ Catat aktivitas'}</button>
      </form>
      {logs.length === 0 ? <div className="empty-state"><h3>Belum ada catatan audit.</h3></div> : (
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Waktu</th><th>Aksi</th><th>Tabel</th><th>ID data</th><th>Detail</th></tr></thead><tbody>
          {logs.map((log) => <tr key={log.id}><td>{formatDate(log.createdAt)}</td><td>{log.action}</td><td>{log.targetTable}</td><td>#{log.targetId}</td><td>{log.metadata || '—'}</td></tr>)}
        </tbody></table></div>
      )}
    </>
  );
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('id-ID') : '—';
}
