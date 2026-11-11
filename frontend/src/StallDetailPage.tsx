import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, deleteStall, getStall } from './api';
import { useAuth } from './auth';
import { canManageStall, categoryIcon } from './presentation';
import { ReviewsSection } from './ReviewsSection';
import { StallMenusSection } from './StallMenusSection';
import { StallFormDialog } from './StallFormDialog';
import type { Stall } from './types';

export function StallDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [stall, setStall] = useState<Stall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setStall(null);
    getStall(id, token)
      .then((data) => {
        if (active) setStall(data);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 404) setError('Warung yang dicari tidak ditemukan.');
        else if (reason instanceof ApiError && reason.status === 401) setError('Sesi tidak valid. Masuk kembali untuk melanjutkan.');
        else if (reason instanceof ApiError && reason.status === 403) setError('Akunmu tidak memiliki izin untuk melihat detail warung ini.');
        else setError(reason instanceof Error ? reason.message : 'Detail warung gagal dimuat.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, token]);

  const canManage = Boolean(stall && canManageStall(user, stall));

  async function remove() {
    if (!stall || !token || !window.confirm(`Hapus warung "${stall.name}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteStall(stall.id, token);
      navigate('/', { replace: true, state: { notice: `Warung "${stall.name}" berhasil dihapus.` } });
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) setError('Sesi tidak valid. Masuk kembali untuk menghapus warung.');
      else if (reason instanceof ApiError && reason.status === 403) setError('Backend menolak penghapusan karena akunmu tidak memiliki izin.');
      else setError(reason instanceof Error ? reason.message : 'Warung tidak dapat dihapus.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="page-wrap"><div className="detail-skeleton" aria-label="Memuat detail warung"><div /></div></div>;
  }

  if (error || !stall) {
    return (
      <section className="state-card">
        <span className="eyebrow">DETAIL WARUNG</span>
        <h1>{error || 'Warung tidak ditemukan.'}</h1>
        <p>Periksa kembali alamat atau kembali ke daftar warung.</p>
        <Link to="/" className="button button-dark">Kembali ke daftar</Link>
      </section>
    );
  }

  return (
    <div className="page-wrap detail-page">
      <Link to="/" className="back-link">← Kembali ke semua warung</Link>
      <article className="detail-layout">
        <div className={`detail-art tone-${stall.id % 4}`}>
          <span className="eyebrow">WARUNG KAMPUS · #{String(stall.id).padStart(3, '0')}</span>
          <span className="detail-art-icon">{categoryIcon(stall.category)}</span>
          <span className="detail-art-caption">RASA YANG SELALU DIRINDUKAN</span>
        </div>
        <div className="detail-content">
          <span className="category-label">{stall.category || 'Warung kampus'}</span>
          <h1>{stall.name}</h1>
          <p className="detail-location"><span>⌖</span> {stall.location || 'Lokasi belum dicantumkan'}</p>
          <div className="detail-rating"><strong>★ {Number(stall.avgRating).toFixed(1)}</strong><span>{stall.reviewCount} ulasan</span></div>
          <div className="detail-divider" />
          <h2>Cerita warung</h2>
          <p className="detail-description">{stall.description || 'Belum ada cerita tentang warung ini.'}</p>
          <div className="detail-note">
            <span>i</span>
            <p>Informasi ditampilkan langsung dari database kantin.</p>
          </div>
          {notice && <p className="success-message" role="status">{notice}</p>}
          {canManage && token && (
            <div className="detail-actions">
              <button className="button button-dark" onClick={() => setEditing(true)}>Edit warung</button>
              {user?.role === 'admin' && (
                <button className="button button-light danger-text" onClick={remove} disabled={busy}>{busy ? 'Menghapus…' : 'Hapus warung'}</button>
              )}
            </div>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
      </article>
      <StallMenusSection stall={stall} />
      <ReviewsSection stallId={stall.id} />
      {editing && token && (
        <StallFormDialog
          stall={stall}
          token={token}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setStall(updated);
            setEditing(false);
            setNotice(`Perubahan warung "${updated.name}" berhasil disimpan.`);
          }}
        />
      )}
    </div>
  );
}
