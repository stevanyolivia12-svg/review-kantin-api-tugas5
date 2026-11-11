import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ApiError, deleteStall, listStalls } from './api';
import { useAuth } from './auth';
import { canManageStall, categoryIcon } from './presentation';
import { StallFormDialog } from './StallFormDialog';
import type { Stall } from './types';

const PAGE_SIZE = 8;

export function StallsPage() {
  const { user, token } = useAuth();
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [reload, setReload] = useState(0);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    () => (location.state as { notice?: string } | null)?.notice ?? null,
  );
  const [editing, setEditing] = useState<Stall | null | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    listStalls({ page, limit: PAGE_SIZE, search, category }, token, controller.signal)
      .then((result) => {
        setStalls(result.data);
        setTotal(result.meta.total);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        if (reason instanceof ApiError && reason.status === 401) {
          setLoadError('Sesi tidak valid. Keluar lalu masuk kembali untuk melanjutkan.');
        } else if (reason instanceof ApiError && reason.status === 403) {
          setLoadError('Akunmu tidak memiliki izin untuk melihat daftar ini.');
        } else {
          setLoadError(reason instanceof Error ? reason.message : 'Daftar warung gagal dimuat.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, search, category, reload, token]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
    setCategory(categoryInput.trim());
  }

  async function remove(stall: Stall) {
    if (!token || !window.confirm(`Hapus warung "${stall.name}"?`)) return;
    setDeletingId(stall.id);
    setActionError(null);
    setNotice(null);
    try {
      await deleteStall(stall.id, token);
      setNotice('Warung berhasil dihapus.');
      setReload((value) => value + 1);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setActionError('Sesi tidak valid. Masuk kembali untuk menghapus warung.');
      } else if (reason instanceof ApiError && reason.status === 403) {
        setActionError('Backend menolak penghapusan. Warung hanya dapat dihapus sesuai hak akses akunmu.');
      } else {
        setActionError(reason instanceof Error ? reason.message : 'Warung tidak dapat dihapus.');
      }
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="page-wrap">
      {user && (
        <section className={`role-welcome role-welcome-${user.role}`} aria-label={`Tampilan ${user.role}`}>
          <div className="role-welcome-icon" aria-hidden="true">
            {user.role === 'admin' ? '⌘' : user.role === 'owner' ? '⌂' : '♡'}
          </div>
          <div>
            <span className="eyebrow">RUANG {roleLabel(user.role)}</span>
            <h2>{roleHeading(user.role, user.name)}</h2>
            <p>{roleDescription(user.role)}</p>
          </div>
          {user.role === 'admin' && <Link className="button button-dark" to="/admin">Dashboard admin →</Link>}
          {user.role === 'customer' && <Link className="button button-dark" to="/menus">Jelajahi menu →</Link>}
          {user.role === 'owner' && <button className="button button-dark" onClick={() => setEditing(null)}>＋ Tambah warung</button>}
        </section>
      )}
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">JELAJAHI KANTIN KAMPUS</span>
          <h1>Yang enak,<br /><em>ada dekatmu.</em></h1>
          <p>Temukan warung andalan kampus—dari sarapan kilat sampai makan siang yang bikin betah.</p>
          <a className="hero-link" href="#daftar-warung">Lihat pilihan warung <span>↓</span></a>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="sun-disc" />
          <span className="art-spark spark-one">✳</span>
          <span className="art-spark spark-two">✦</span>
          <div className="art-card art-card-back"><span>HARI INI</span><strong>enak<br />banget.</strong></div>
          <div className="art-card art-card-front"><span className="plate">◉</span><span>Tempat makan<br />favoritmu</span><b>↗</b></div>
          <span className="art-caption">DARI KAMPUS, UNTUK KAMPUS</span>
        </div>
        <div className="hero-index"><strong>{String(total).padStart(2, '0')}</strong><span>WARUNG<br />TERDAFTAR</span></div>
      </section>

      <section className="list-section" id="daftar-warung">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PILIHAN HARI INI</span>
            <h2>Singgah di sini <span>→</span></h2>
          </div>
          {user && ['admin', 'owner'].includes(user.role) && (
            <button className="button button-dark" onClick={() => setEditing(null)}>
              <span aria-hidden="true">＋</span> Tambah warung
            </button>
          )}
          {!user && (
            <Link className="button button-dark" to="/login">Pemilik warung? Masuk untuk menambahkan</Link>
          )}
        </div>

        <form className="filter-bar" onSubmit={applyFilters}>
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Cari nama warung..." aria-label="Cari nama warung" />
          </label>
          <label className="category-field">
            <span className="eyebrow">KATEGORI</span>
            <input value={categoryInput} onChange={(event) => setCategoryInput(event.target.value)} placeholder="Semua kategori" aria-label="Filter kategori" maxLength={50} />
          </label>
          <button type="submit" className="button button-light">Cari warung <span>→</span></button>
        </form>

        {notice && <p className="success-message" role="status">{notice}</p>}
        {actionError && <p className="inline-error" role="alert">{actionError}</p>}
        {loadError && <div className="inline-error" role="alert"><span>{loadError}</span><button className="button button-light" onClick={() => setReload((value) => value + 1)}>Coba lagi</button></div>}
        {loading ? (
          <div className="loading-grid" aria-label="Memuat daftar warung">
            {Array.from({ length: 4 }, (_, index) => <div className="skeleton-card" key={index}><div /><span /><span /></div>)}
          </div>
        ) : !loadError && stalls.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">⌕</span>
            <h3>{search || category ? 'Belum ada yang cocok.' : 'Belum ada warung di sini.'}</h3>
            <p>{search || category ? 'Coba kata kunci atau kategori yang berbeda.' : 'Warung yang terdaftar akan muncul di halaman ini.'}</p>
          </div>
        ) : !loadError ? (
          <>
            <div className="stall-grid">
              {stalls.map((stall, index) => (
                <article className={`stall-card tone-${index % 4}`} key={stall.id}>
                  <Link to={`/stalls/${stall.id}`} className="stall-art" aria-label={`Lihat detail ${stall.name}`}>
                    <span className="stall-art-number">{String(stall.id).padStart(2, '0')}</span>
                    <span className="stall-art-icon" aria-hidden="true">{categoryIcon(stall.category)}</span>
                    {stall.isPopular && <span className="popular-tag">✦ Favorit</span>}
                    <span className="stall-art-arrow">↗</span>
                  </Link>
                  <div className="stall-card-body">
                    <div className="stall-card-top">
                      <span className="category-label">{stall.category || 'Warung kampus'}</span>
                      <span className="rating"><span>★</span> {Number(stall.avgRating).toFixed(1)} <small>({stall.reviewCount})</small></span>
                    </div>
                    <Link to={`/stalls/${stall.id}`} className="stall-name">{stall.name}</Link>
                    <p className="stall-location"><span>⌖</span> {stall.location || 'Lokasi belum dicantumkan'}</p>
                    {canManageStall(user, stall) && (
                      <div className="card-actions">
                        <button className="button button-quiet" onClick={() => setEditing(stall)}>Edit</button>
                        {user?.role === 'admin' && (
                          <button className="button button-quiet danger-text" onClick={() => remove(stall)} disabled={deletingId === stall.id}>
                            {deletingId === stall.id ? 'Menghapus…' : 'Hapus'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {totalPages > 1 && (
              <nav className="pagination" aria-label="Halaman daftar warung">
                <span>Halaman {page} dari {totalPages} <small>· {total} warung</small></span>
                <div>
                  <button className="button button-light" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>← Sebelumnya</button>
                  <button className="button button-light" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Berikutnya →</button>
                </div>
              </nav>
            )}
          </>
        ) : null}
      </section>

      {editing !== undefined && token && (
        <StallFormDialog
          stall={editing}
          token={token}
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => {
            setEditing(undefined);
            setNotice(`Warung "${saved.name}" berhasil disimpan.`);
            setReload((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}

function roleLabel(role: string) {
  return { admin: 'ADMIN', owner: 'PEMILIK WARUNG', customer: 'PELANGGAN' }[role] ?? role.toUpperCase();
}

function roleHeading(role: string, name: string) {
  if (role === 'admin') return `Halo, ${name}. Kelola kantinmu.`;
  if (role === 'owner') return `Halo, ${name}. Warungmu menunggu.`;
  return `Selamat datang, ${name}.`;
}

function roleDescription(role: string) {
  if (role === 'admin') return 'Atur daftar warung dan buka dashboard untuk mengelola pengguna, laporan, serta audit.';
  if (role === 'owner') return 'Kamu dapat menambah warung dan mengubah warung milikmu. Penghapusan hanya untuk admin.';
  return 'Jelajahi warung dan menu, lalu bagikan ulasanmu sebagai pelanggan.';
}
