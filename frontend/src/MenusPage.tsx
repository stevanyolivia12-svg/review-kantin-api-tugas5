import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, deleteMenu, listAllStalls, listMenus } from './api';
import { useAuth } from './auth';
import { useCart } from './CartContext';
import { FoodArtwork } from './FoodArtwork';
import { formatRupiah } from './format';
import { MenuFormDialog } from './MenuFormDialog';
import type { MenuItem, Stall } from './types';

export function MenusPage() {
  const { user, token, checkingSession } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [search, setSearch] = useState('');
  const [stallFilter, setStallFilter] = useState('all');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<MenuItem | null | undefined>(undefined);
  const [reload, setReload] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([listMenus(), listAllStalls(token)])
      .then(([items, stallList]) => {
        if (!active) return;
        setMenus(items);
        setStalls(stallList);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) setLoadError('Sesi tidak valid. Masuk kembali untuk melanjutkan.');
        else if (reason instanceof ApiError && reason.status === 403) setLoadError('Akunmu tidak memiliki izin melihat menu.');
        else setLoadError(reason instanceof Error ? reason.message : 'Katalog menu gagal dimuat.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [reload, token]);

  const stallById = useMemo(() => new Map(stalls.map((stall) => [stall.id, stall])), [stalls]);
  const manageableStalls = stalls.filter((stall) =>
    user?.role === 'admin' || (user?.role === 'owner' && user.id === stall.ownerId),
  );
  const visibleMenus = menus.filter((menu) => {
    const stall = stallById.get(menu.stallId);
    const matchesSearch = `${menu.name} ${stall?.name ?? ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesStall = stallFilter === 'all' || menu.stallId === Number(stallFilter);
    return matchesSearch && matchesStall && (!availableOnly || menu.isAvailable);
  });

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function addToCart(menu: MenuItem, stallName: string) {
    if (checkingSession) return;
    if (!user || !token) {
      navigate('/login', { state: { from: '/menus' } });
      return;
    }
    addItem(menu, stallName);
  }

  async function remove(menu: MenuItem) {
    if (!token || !window.confirm(`Hapus menu "${menu.name}"?`)) return;
    setActionError(null);
    setNotice(null);
    setDeletingId(menu.id);
    try {
      await deleteMenu(menu.id, token);
      setNotice(`Menu "${menu.name}" berhasil dihapus.`);
      setReload((value) => value + 1);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) setActionError('Sesi berakhir. Masuk kembali untuk menghapus menu.');
      else if (reason instanceof ApiError && reason.status === 403) setActionError('Backend menolak perubahan. Menu hanya dapat dikelola pemilik warung atau admin.');
      else setActionError(reason instanceof Error ? reason.message : 'Menu tidak dapat dihapus.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="page-wrap catalog-page">
      <section className="catalog-hero">
        <span className="eyebrow">SEMUA HIDANGAN · LANGSUNG DARI DATABASE</span>
        <h1>Menu yang bikin<br /><em>balik lagi.</em></h1>
        <p>Jelajahi seluruh hidangan kantin, cari menu favorit, dan cek ketersediaannya.</p>
        <div className="catalog-count"><strong>{menus.length}</strong><span>MENU<br />TERDAFTAR</span></div>
      </section>

      <section className="catalog-section">
        <div className="section-heading">
          <div><span className="eyebrow">KATALOG LENGKAP</span><h2>Semua menu <span>→</span></h2></div>
          <div className="catalog-heading-actions">
            {(!user || user.role === 'admin' || user.role === 'owner') && (
              <Link className="button button-light" to={user ? '/' : '/login'}>＋ Tambah warung</Link>
            )}
            {manageableStalls.length > 0 && (
              <button className="button button-dark" onClick={() => setEditing(null)}>＋ Tambah menu</button>
            )}
          </div>
        </div>
        <form className="catalog-filters" onSubmit={applySearch}>
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama hidangan atau warung…" aria-label="Cari menu" />
          </label>
          <select aria-label="Filter warung" value={stallFilter} onChange={(event) => setStallFilter(event.target.value)}>
            <option value="all">Semua warung</option>
            {stalls.map((stall) => <option value={stall.id} key={stall.id}>{stall.name}</option>)}
          </select>
          <label className="check-filter">
            <input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} />
            Tersedia saja
          </label>
        </form>
        {notice && <p className="success-message" role="status">{notice}</p>}
        {actionError && <p className="inline-error" role="alert">{actionError}</p>}
        {loadError && <div className="inline-error" role="alert"><span>{loadError}</span><button className="button button-light" onClick={() => setReload((value) => value + 1)}>Coba lagi</button></div>}
        {loading ? (
          <div className="loading-grid">{Array.from({ length: 4 }, (_, index) => <div className="skeleton-card" key={index}><div /><span /><span /></div>)}</div>
        ) : !loadError && visibleMenus.length === 0 ? (
          <div className="empty-state"><span className="empty-icon">⌕</span><h3>{menus.length ? 'Tidak ada menu yang cocok.' : 'Belum ada menu terdaftar.'}</h3><p>Coba ubah pencarian atau filter warung.</p></div>
        ) : !loadError && (
          <div className="menu-grid">
            {visibleMenus.map((menu) => {
              const stall = stallById.get(menu.stallId);
              const canManage = Boolean(stall && (user?.role === 'admin' || (user?.role === 'owner' && stall.ownerId === user.id)));
              return (
                <article className={`menu-card ${menu.isAvailable ? '' : 'menu-unavailable'}`} key={menu.id}>
                  <FoodArtwork name={menu.name} category={stall?.category} id={menu.id} />
                  <div className="menu-card-content">
                    <div className="menu-card-meta">
                      <span className="category-label">{stall?.category || 'Hidangan kantin'}</span>
                      <span className={`availability ${menu.isAvailable ? 'is-available' : 'is-unavailable'}`}>
                        <i /> {menu.isAvailable ? 'Tersedia' : 'Habis'}
                      </span>
                    </div>
                    <h3>{menu.name}</h3>
                    {stall ? <Link to={`/stalls/${stall.id}`} className="menu-stall-link">⌖ {stall.name}</Link> : <span className="menu-stall-link">Warung #{menu.stallId}</span>}
                    <div className="menu-card-bottom">
                      <strong>{formatRupiah(menu.price)}</strong>
                      <div className="menu-card-actions">
                        {menu.isAvailable && (
                          <button
                            className="button button-dark button-small"
                            disabled={checkingSession}
                            onClick={() => addToCart(menu, stall?.name ?? `Warung #${menu.stallId}`)}
                          >
                            {checkingSession ? 'Memeriksa sesi…' : '＋ Keranjang'}
                          </button>
                        )}
                        {canManage && (
                          <div className="card-actions">
                            <button className="button button-quiet" onClick={() => setEditing(menu)}>Edit</button>
                            <button className="button button-quiet danger-text" onClick={() => remove(menu)} disabled={deletingId !== null}>
                              {deletingId === menu.id ? 'Menghapus…' : 'Hapus'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {editing !== undefined && token && (
        <MenuFormDialog
          menu={editing}
          stalls={manageableStalls}
          token={token}
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => {
            setEditing(undefined);
            setNotice(`Menu "${saved.name}" berhasil disimpan.`);
            setReload((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}
