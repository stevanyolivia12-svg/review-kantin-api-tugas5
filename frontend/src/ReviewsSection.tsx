import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, createFlag, createLike, createReview, deleteLike, deleteReview, listMyLikes, listReviews } from './api';
import { useAuth } from './auth';
import type { Like, Review } from './types';

export function ReviewsSection({ stallId }: { stallId: number }) {
  const { user, token } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [likes, setLikes] = useState<Like[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyReviewId, setBusyReviewId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const requests: [Promise<Review[]>, Promise<Like[]>] = [
      listReviews(stallId),
      token ? listMyLikes(token) : Promise.resolve([]),
    ];
    Promise.all(requests)
      .then(([reviewList, myLikes]) => {
        if (!active) return;
        setReviews(reviewList);
        setLikes(myLikes.filter((like) => reviewList.some((review) => review.id === like.reviewId)));
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Ulasan gagal dimuat.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [stallId, token, reload]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await createReview({ stallId, rating, comment: comment.trim() || null }, token);
      setComment('');
      setRating(5);
      setNotice('Ulasan berhasil dikirim.');
      setReload((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ulasan tidak dapat dikirim.');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleLike(review: Review) {
    if (!token) return;
    const existing = likes.find((like) => like.reviewId === review.id);
    setBusyReviewId(review.id);
    setError(null);
    try {
      if (existing) await deleteLike(existing.id, token);
      else await createLike(review.id, token);
      setReload((value) => value + 1);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) setNotice('Kamu sudah menyukai ulasan ini.');
      else setError(reason instanceof Error ? reason.message : 'Like tidak dapat disimpan.');
    } finally {
      setBusyReviewId(null);
    }
  }

  async function removeReview(review: Review) {
    if (!token || !window.confirm('Hapus ulasan ini?')) return;
    setBusyReviewId(review.id);
    setError(null);
    try {
      await deleteReview(review.id, token);
      setNotice('Ulasan berhasil dihapus.');
      setReload((value) => value + 1);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 403) setError('Ulasan ini hanya dapat dihapus oleh pembuatnya atau admin.');
      else setError(reason instanceof Error ? reason.message : 'Ulasan tidak dapat dihapus.');
    } finally {
      setBusyReviewId(null);
    }
  }

  async function reportReview(review: Review) {
    if (!token) return;
    const reason = window.prompt('Jelaskan alasan melaporkan ulasan ini:');
    if (reason === null) return;
    setError(null);
    try {
      await createFlag({ reviewId: review.id, reason: reason.trim() || null }, token);
      setNotice('Ulasan berhasil dilaporkan ke admin.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Laporan tidak dapat dikirim.');
    }
  }

  const canWriteReview = user?.role === 'customer' && Boolean(token);

  return (
    <section className="reviews-section">
      <div className="section-heading">
        <div><span className="eyebrow">CERITA PENGUNJUNG</span><h2>Ulasan <span>→</span></h2></div>
        <span className="review-total">{reviews.length} ulasan</span>
      </div>
      {notice && <p className="success-message" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {canWriteReview && (
        <form className="review-form panel" onSubmit={submit}>
          <label className="field">
            Penilaian
            <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
              {[5, 4, 3, 2, 1].map((value) => <option value={value} key={value}>{'★'.repeat(value)} — {value}/5</option>)}
            </select>
          </label>
          <label className="field">
            Ceritakan pengalamanmu
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={4000} rows={3} placeholder="Apa yang paling kamu suka?" />
          </label>
          <button className="button button-dark" disabled={submitting}>{submitting ? 'Mengirim…' : 'Kirim ulasan'}</button>
        </form>
      )}
      {!token && <p className="muted review-sign-in"><Link to="/login">Masuk sebagai customer</Link> untuk menulis ulasan dan menyukai cerita orang lain.</p>}
      {token && user?.role !== 'customer' && <p className="muted review-sign-in">Ulasan dan like hanya tersedia untuk akun customer.</p>}
      {loading ? (
        <div className="review-loading" aria-label="Memuat ulasan"><span /><span /><span /></div>
      ) : reviews.length === 0 ? (
        <div className="empty-state review-empty"><span className="empty-icon">✎</span><h3>Belum ada ulasan.</h3><p>Jadi yang pertama berbagi cerita tentang warung ini.</p></div>
      ) : (
        <div className="review-list">
          {reviews.map((review) => {
            const liked = likes.some((like) => like.reviewId === review.id);
            const canDelete = user?.role === 'admin' || (user?.role === 'customer' && user.id === review.userId);
            return (
              <article className="review-card" key={review.id}>
                <span className="review-avatar">{(review.user?.name ?? 'P').slice(0, 1).toUpperCase()}</span>
                <div className="review-main">
                  <div className="review-heading">
                    <div><strong>{review.user?.name ?? 'Pengunjung'}</strong><span className="review-date">{review.createdAt ? new Date(review.createdAt).toLocaleDateString('id-ID') : ''}</span></div>
                    <span className="review-stars" aria-label={`Rating ${review.rating} dari 5`}>{'★'.repeat(review.rating)}<span>{'★'.repeat(5 - review.rating)}</span></span>
                  </div>
                  {review.comment && <p>{review.comment}</p>}
                  <div className="review-actions">
                    {user?.role === 'customer' && token && (
                      <>
                        <button className={`review-action ${liked ? 'is-liked' : ''}`} onClick={() => toggleLike(review)} disabled={busyReviewId === review.id}>
                          ♥ {review.likeCount} {liked ? 'Disukai' : 'Suka'}
                        </button>
                        <button className="review-action" onClick={() => reportReview(review)}>Laporkan</button>
                      </>
                    )}
                    {canDelete && token && (
                      <button className="review-action danger-text" onClick={() => removeReview(review)} disabled={busyReviewId === review.id}>Hapus</button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
