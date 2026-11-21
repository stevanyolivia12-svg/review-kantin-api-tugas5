import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, createManagedUser, getAuditLog, listAuditLogs, listFlags, listUsers, updateFlag, type AuditLogFilters } from './api';
import { useAuth } from './auth';
import type { AuditLog, Flag, ManagedUser } from './types';

type AdminTab = 'users' | 'flags' | 'logs';

export function AdminPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      listUsers(token),
      listFlags(token),
      listAuditLogs(token, { page: 1, pageSize: 1 }),
    ])
      .then(([userRows, flagRows, logPage]) => {
        if (!active) return;
        setUsers(userRows);
        setFlags(flagRows);
        setLogsTotal(logPage.pagination.total);
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
          <div><strong>{logsTotal}</strong><span>LOG AKTIVITAS</span></div>
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
            {tab === 'logs' && <LogsPanel token={token!} />}
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

function LogsPanel({ token }: { token: string }) {
  const [filters, setFilters] = useState<Omit<AuditLogFilters, 'page' | 'pageSize'>>({});
  const [form, setForm] = useState({ action: '', targetTable: '', targetId: '', userId: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AuditLog | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailReload, setDetailReload] = useState(0);
  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    listAuditLogs(token, { page, pageSize, ...filters }, controller.signal)
      .then((result) => {
        setLogs(result.items);
        setTotal(result.pagination.total);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : 'Audit log gagal dimuat.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, page, pageSize, reload, token]);

  useEffect(() => {
    if (detailId === null) return;
    let active = true;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    getAuditLog(detailId, token)
      .then((item) => { if (active) setDetail(item); })
      .catch((reason: unknown) => {
        if (active) setDetailError(reason instanceof Error ? reason.message : 'Detail audit log gagal dimuat.');
      })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [detailId, detailReload, token]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters({
      ...(form.action.trim() ? { action: form.action.trim() } : {}),
      ...(form.targetTable ? { targetTable: form.targetTable } : {}),
      ...(form.targetId ? { targetId: Number(form.targetId) } : {}),
      ...(form.userId ? { userId: Number(form.userId) } : {}),
      ...(form.from ? { from: form.from } : {}),
      ...(form.to ? { to: form.to } : {}),
    });
  }

  function clearFilters() {
    setForm({ action: '', targetTable: '', targetId: '', userId: '', from: '', to: '' });
    setFilters({});
    setPage(1);
  }

  return (
    <>
      <div className="admin-section-heading">
        <div><span className="eyebrow">CATATAN SISTEM</span><h2>Audit log</h2></div>
        <span>{total} catatan · ditulis otomatis oleh backend</span>
      </div>
      <form className="audit-filter-form panel" onSubmit={applyFilters}>
        <label className="field">Aksi<input value={form.action} onChange={(event) => setForm((value) => ({ ...value, action: event.target.value }))} maxLength={50} placeholder="Contoh: CREATE_MENU" /></label>
        <label className="field">Tabel
          <select value={form.targetTable} onChange={(event) => setForm((value) => ({ ...value, targetTable: event.target.value }))}>
            <option value="">Semua tabel</option>
            {['USERS', 'STALLS', 'MENU_ITEMS', 'REVIEWS', 'LIKES', 'FLAGS'].map((table) => <option value={table} key={table}>{table}</option>)}
          </select>
        </label>
        <label className="field">ID target<input type="number" min="1" step="1" value={form.targetId} onChange={(event) => setForm((value) => ({ ...value, targetId: event.target.value }))} /></label>
        <label className="field">ID pengguna<input type="number" min="1" step="1" value={form.userId} onChange={(event) => setForm((value) => ({ ...value, userId: event.target.value }))} /></label>
        <label className="field">Dari tanggal<input type="date" value={form.from} onChange={(event) => setForm((value) => ({ ...value, from: event.target.value }))} /></label>
        <label className="field">Sampai tanggal<input type="date" value={form.to} onChange={(event) => setForm((value) => ({ ...value, to: event.target.value }))} /></label>
        <div className="audit-filter-actions">
          <button className="button button-dark" type="submit">Terapkan filter</button>
          <button className="button button-light" type="button" onClick={clearFilters}>Reset</button>
        </div>
      </form>
      {error && <div className="inline-error" role="alert"><span>{error}</span><button className="button button-light" onClick={() => setReload((value) => value + 1)}>Coba lagi</button></div>}
      {loading ? (
        <div className="loading-grid audit-loading" aria-label="Memuat audit log"><div className="skeleton-card"><div /><span /><span /></div></div>
      ) : !error && logs.length === 0 ? (
        <div className="empty-state"><h3>Tidak ada audit log yang cocok.</h3><p>Ubah filter atau lakukan aktivitas di aplikasi.</p></div>
      ) : !error && (
        <>
          <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Tabel</th><th>ID target</th><th></th></tr></thead><tbody>
            {logs.map((log) => <tr key={log.id}>
              <td>{formatDate(log.createdAt)}</td>
              <td>{log.userName}<small className="audit-user-email">{log.userEmail} · #{log.userId}</small></td>
              <td><span className="audit-action">{log.action}</span></td>
              <td>{log.targetTable}</td>
              <td>#{log.targetId}</td>
              <td><button className="button button-quiet" onClick={() => setDetailId(log.id)}>Detail</button></td>
            </tr>)}
          </tbody></table></div>
          <nav className="pagination audit-pagination" aria-label="Pagination audit log">
            <span>Halaman {page} dari {totalPages} <small>· {total} catatan</small></span>
            <div>
              <button className="button button-light" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Sebelumnya</button>
              <button className="button button-light" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Berikutnya →</button>
            </div>
          </nav>
        </>
      )}
      {detailId !== null && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDetailId(null);
        }}>
          <section className="panel dialog audit-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title">
            <button className="dialog-close" type="button" aria-label="Tutup detail" onClick={() => setDetailId(null)}>×</button>
            <span className="eyebrow">CATATAN AUDIT · #{detailId}</span>
            <h2 id="audit-detail-title">Detail aktivitas</h2>
            {detailLoading ? <div className="review-loading" aria-label="Memuat detail audit"><span /><span /></div>
              : detailError ? <div className="inline-error" role="alert"><span>{detailError}</span><button className="button button-light" onClick={() => setDetailReload((value) => value + 1)}>Coba lagi</button></div>
                : detail && <AuditLogDetails log={detail} />}
          </section>
        </div>
      )}
    </>
  );
}

function AuditLogDetails({ log }: { log: AuditLog }) {
  const metadata = log.metadata;
  const value = (key: string) => typeof metadata === 'object' && metadata ? metadata[key] : undefined;

  return (
    <dl className="audit-detail-list">
      <div><dt>Waktu</dt><dd>{formatDate(log.createdAt)}</dd></div>
      <div><dt>Pengguna</dt><dd>{log.userName} ({log.userEmail}) · #{log.userId}</dd></div>
      <div><dt>Aksi</dt><dd>{log.action}</dd></div>
      <div><dt>Target</dt><dd>{log.targetTable} · #{log.targetId}</dd></div>
      <div><dt>Role</dt><dd>{String(value('role') ?? '—')}</dd></div>
      <div><dt>Hasil</dt><dd>{String(value('result') ?? '—')}</dd></div>
      <div><dt>IP address</dt><dd>{String(value('ip_address') ?? '—')}</dd></div>
      <div><dt>User agent</dt><dd className="audit-user-agent">{String(value('user_agent') ?? '—')}</dd></div>
      <div className="audit-metadata-row"><dt>Metadata</dt><dd><pre>{JSON.stringify(metadata, null, 2) ?? '—'}</pre></dd></div>
    </dl>
  );
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('id-ID') : '—';
}
