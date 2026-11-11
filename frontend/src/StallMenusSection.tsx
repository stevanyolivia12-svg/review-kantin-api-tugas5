import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, deleteMenu, getStallMenus } from './api';
import { useAuth } from './auth';
import { useCart } from './CartContext';
import { FoodArtwork } from './FoodArtwork';
import { formatRupiah } from './format';
import { MenuFormDialog } from './MenuFormDialog';
import type { MenuItem, Stall } from './types';

export function StallMenusSection({ stall }: { stall: Stall }) {
  const { user, token, checkingSession } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MenuItem | null | undefined>(undefined);
  const [reload, setReload] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const canManage = Boolean(token && (user?.role === 'admin' || (user?.role === 'owner' && user.id === stall.ownerId)));

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    getStallMenus(stall.id)
      .then((items) => { if (active) setMenus(items); })
      .catch((reason: unknown) => {
        if (active) setLoadError(reason instanceof Error ? reason.message : 'Menu warung gagal dimuat.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [stall.id, reload]);

  async function remove(menu: MenuItem) {
    if (!token || !window.confirm(`Hapus menu "${menu.name}"?`)) return;
    setActionError(null);
    setDeletingId(menu.id);
    try {
      await deleteMenu(menu.id, token);
      setReload((value) => value + 1);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 403) setActionError('Menu hanya dapat dihapus oleh admin atau pemilik warung.');
      else setActionError(reason instanceof Error ? reason.message : 'Menu tidak dapat dihapus.');
    } finally {
      setDeletingId(null);
    }
  }

  function addToCart(menu: MenuItem) {
    if (checkingSession) return;
    if (!user || !token) {
      navigate('/login', { state: { from: `/stalls/${stall.id}` } });
      return;
    }
    addItem(menu, stall.name);
  }

  return (
    <section className="stall-menus-section">
      <div className="section-heading">
        <div><span className="eyebrow">DARI DAPUR MEREKA</span><h2>Menu warung <span>→</span></h2></div>
        {canManage && <button className="button button-dark" onClick={() => setEditing(null)}>＋ Tambah menu</button>}
      </div>
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      {loading ? <div className="review-loading" aria-label="Memuat menu"><span /><span /></div>
        : loadError ? <div className="inline-error" role="alert"><span>{loadError}</span><button className="button button-light" onClick={() => setReload((value) => value + 1)}>Coba lagi</button></div>
          : menus.length === 0 ? <div className="empty-state"><span className="empty-icon">⌕</span><h3>Belum ada menu tercatat.</h3><p>Menu yang ditambahkan pemilik warung akan muncul di sini.</p></div>
            : <div className="stall-menu-grid">
            {menus.map((menu) => (
              <article className={`stall-menu-card ${menu.isAvailable ? '' : 'menu-unavailable'}`} key={menu.id}>
                <FoodArtwork name={menu.name} category={stall.category} id={menu.id} />
                <div><div className="menu-card-meta"><span className={`availability ${menu.isAvailable ? 'is-available' : 'is-unavailable'}`}><i />{menu.isAvailable ? 'Tersedia' : 'Habis'}</span><strong>{formatRupiah(menu.price)}</strong></div><h3>{menu.name}</h3>
                  <div className="stall-menu-actions">
                    {menu.isAvailable && (
                      <button className="button button-dark button-small" disabled={checkingSession} onClick={() => addToCart(menu)}>
                        {checkingSession ? 'Memeriksa sesi…' : '＋ Keranjang'}
                      </button>
                    )}
                    {canManage && <div className="card-actions"><button className="button button-quiet" onClick={() => setEditing(menu)}>Edit</button><button className="button button-quiet danger-text" onClick={() => remove(menu)} disabled={deletingId !== null}>{deletingId === menu.id ? 'Menghapus…' : 'Hapus'}</button></div>}
                  </div>
                </div>
              </article>
            ))}
          </div>}
      {editing !== undefined && token && (
        <MenuFormDialog
          menu={editing}
          stalls={[stall]}
          initialStallId={stall.id}
          token={token}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); setReload((value) => value + 1); }}
        />
      )}
    </section>
  );
}
