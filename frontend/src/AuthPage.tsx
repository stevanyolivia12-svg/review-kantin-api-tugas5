import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';

export function AuthPage({ mode, redirectTo = '/' }: { mode: 'login' | 'register'; redirectTo?: string }) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isRegister) await register(name, email, password);
      else await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Permintaan tidak dapat diproses.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-story">
        <span className="eyebrow">RASA LOKAL, CERITA KAMPUS</span>
        <h1>{isRegister ? 'Mulai jelajahi rasa baru.' : 'Senang melihatmu kembali.'}</h1>
        <p>Temukan warung favorit, kenali menu andalan, dan bantu komunitas kampus makan lebih enak.</p>
        <div className="auth-stamp">Dibuat untuk pecinta jajan ♡</div>
      </div>
      <form className="panel auth-form" onSubmit={submit}>
        <span className="eyebrow">{isRegister ? 'BUAT AKUN' : 'AKUN KAMU'}</span>
        <h2>{isRegister ? 'Daftar dulu, yuk' : 'Masuk ke KantinKita'}</h2>
        <p className="muted">{isRegister ? 'Akun baru mendapat akses customer.' : 'Masuk untuk mengelola warung sesuai peranmu.'}</p>
        {isRegister && (
          <label className="field">
            Nama
            <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength={3} maxLength={100} required />
          </label>
        )}
        <label className="field">
          Email
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={150} required />
        </label>
        <label className="field">
          Password
          <input type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={isRegister ? 8 : 1} maxLength={128} required />
          {isRegister && <small>Minimal 8 karakter.</small>}
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-dark button-wide" disabled={busy}>
          {busy ? 'Mengirim…' : isRegister ? 'Buat akun' : 'Masuk'}
        </button>
        <p className="form-switch">
          {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
          <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Masuk' : 'Daftar'}</Link>
        </p>
      </form>
    </section>
  );
}
