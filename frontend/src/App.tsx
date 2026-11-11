import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { AdminPage } from './AdminPage';
import { AuthPage } from './AuthPage';
import { useCart } from './CartContext';
import { formatRupiah } from './format';
import { MenusPage } from './MenusPage';
import { StallDetailPage } from './StallDetailPage';
import { StallsPage } from './StallsPage';

export function App() {
  const { user, logout, sessionMessage, checkingSession } = useAuth();
  const { items, loading: cartLoading, storageError, setQuantity, removeItem, clearCart } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const postLoginPath = (location.state as { from?: unknown } | null)?.from;
  const safePostLoginPath = typeof postLoginPath === 'string'
    && (postLoginPath === '/menus' || /^\/stalls\/\d+$/.test(postLoginPath))
    ? postLoginPath
    : '/';
  const cartCount = items.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);

  function signOut() {
    logout();
    navigate('/');
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Kantin Kita, beranda">
          <span className="brand-mark">K</span>
          <span>Kantin<span className="brand-accent">Kita</span></span>
        </Link>
        <nav className="header-nav" aria-label="Navigasi utama">
          <Link to="/">Jelajahi</Link>
          <Link to="/menus">Menu</Link>
          <details className="cart-menu">
            <summary className="button button-light cart-trigger" aria-label={cartLoading ? 'Memuat keranjang belanja' : `Keranjang belanja, ${cartCount} item`}>
              <span aria-hidden="true">🛒</span> Keranjang <span className="cart-count">{cartLoading ? '…' : cartCount}</span>
            </summary>
            <div className="cart-popover">
              <div className="cart-heading">
                <strong>Keranjang belanja</strong>
                {!cartLoading && items.length > 0 && <button className="button button-quiet" onClick={clearCart}>Kosongkan</button>}
              </div>
              {storageError && <p className="cart-storage-error" role="alert">{storageError}</p>}
              {cartLoading ? (
                <p className="cart-empty" role="status">Memuat keranjang…</p>
              ) : items.length === 0 ? (
                <p className="cart-empty">Keranjangmu masih kosong. Tambahkan menu dari katalog.</p>
              ) : (
                <>
                  <ul className="cart-items">
                    {items.map((item) => (
                      <li key={item.menuId}>
                        <div className="cart-item-info">
                          <strong>{item.menuName}</strong>
                          <span>{item.stallName} · {formatRupiah(item.unitPrice)}</span>
                        </div>
                        <div className="cart-item-controls">
                          <button aria-label={`Kurangi ${item.menuName}`} onClick={() => setQuantity(item.menuId, item.quantity - 1)}>−</button>
                          <span>{item.quantity}</span>
                          <button aria-label={`Tambah ${item.menuName}`} onClick={() => setQuantity(item.menuId, item.quantity + 1)}>+</button>
                          <button className="cart-remove" aria-label={`Hapus ${item.menuName}`} onClick={() => removeItem(item.menuId)}>×</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="cart-total"><span>Total sementara</span><strong>{formatRupiah(cartTotal)}</strong></div>
                  <p className="cart-note">Keranjang ini belum mengirim pesanan atau pembayaran.</p>
                </>
              )}
            </div>
          </details>
          {user?.role === 'admin' && <Link to="/admin">Admin</Link>}
          {checkingSession ? (
            <span className="nav-note">Memeriksa sesi…</span>
          ) : user ? (
            <div className="user-menu">
              <details className="profile-menu">
                <summary className="user-chip">
                  <span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
                  <span>{user.name}<small>{roleLabel(user.role)}</small></span>
                </summary>
                <div className="profile-popover">
                  <span className="eyebrow">INFORMASI PENGGUNA</span>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                  <span className={`role-badge role-${user.role}`}>{roleLabel(user.role)}</span>
                  <small>ID pengguna · #{user.id}</small>
                  {user.role === 'admin' && <Link to="/admin">Buka dashboard admin →</Link>}
                  {user.role === 'owner' && <Link to="/#daftar-warung">Kelola warung saya →</Link>}
                  {user.role === 'customer' && <Link to="/menus">Jelajahi menu →</Link>}
                </div>
              </details>
              <button className="button button-quiet" onClick={signOut}>Keluar</button>
            </div>
          ) : (
            <div className="auth-links">
              <Link to="/login">Masuk</Link>
              <Link className="button button-dark button-small" to="/register">Daftar</Link>
            </div>
          )}
        </nav>
      </header>

      {sessionMessage && !user && (
        <div className="session-notice" role="status">{sessionMessage}</div>
      )}

      <main>
        <Routes>
          <Route path="/" element={<StallsPage />} />
          <Route path="/menus" element={<MenusPage />} />
          <Route path="/stalls/:id" element={<StallDetailPage />} />
          <Route path="/admin" element={user?.role === 'admin' ? <AdminPage /> : <NotAuthorized />} />
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" redirectTo={safePostLoginPath} />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <span>KantinKita</span>
        <span>Temukan rasa favoritmu di sekitar kampus.</span>
      </footer>
    </div>
  );
}

function roleLabel(role: string) {
  return { admin: 'Admin', owner: 'Pemilik', customer: 'Customer' }[role] ?? role;
}

function NotFound() {
  return (
    <section className="state-card">
      <span className="eyebrow">404 — HALAMAN TIDAK DITEMUKAN</span>
      <h1>Sepertinya kamu tersesat.</h1>
      <p>Halaman yang dicari tidak tersedia.</p>
      <Link to="/" className="button button-dark">Kembali ke beranda</Link>
    </section>
  );
}

function NotAuthorized() {
  return (
    <section className="state-card">
      <span className="eyebrow">403 — AKSES DIBATASI</span>
      <h1>Halaman admin khusus admin.</h1>
      <p>Data akan tetap diperiksa kembali oleh backend saat setiap request.</p>
      <Link to="/" className="button button-dark">Kembali ke beranda</Link>
    </section>
  );
}
