import { useState, type FormEvent } from 'react';
import { createMenu, updateMenu } from './api';
import type { MenuItem, MenuItemInput, Stall } from './types';

export function MenuFormDialog({
  menu,
  stalls,
  initialStallId,
  token,
  onClose,
  onSaved,
}: {
  menu: MenuItem | null;
  stalls: Stall[];
  initialStallId?: number;
  token: string;
  onClose: () => void;
  onSaved: (menu: MenuItem) => void;
}) {
  const [stallId, setStallId] = useState(menu?.stallId ?? initialStallId ?? stalls[0]?.id ?? 0);
  const [name, setName] = useState(menu?.name ?? '');
  const [price, setPrice] = useState(String(menu?.price ?? ''));
  const [isAvailable, setIsAvailable] = useState(menu?.isAvailable ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const input: MenuItemInput = {
        stallId,
        name: name.trim(),
        price: Number(price),
        isAvailable,
      };
      const saved = menu
        ? await updateMenu(menu.id, input, token)
        : await createMenu(input, token);
      onSaved(saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Menu gagal disimpan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="panel dialog" role="dialog" aria-modal="true" aria-labelledby="menu-form-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Tutup form">×</button>
        <span className="eyebrow">KATALOG KANTIN</span>
        <h2 id="menu-form-title">{menu ? 'Edit menu' : 'Tambah menu'}</h2>
        <p className="muted">Menu disimpan langsung ke database.</p>
        <form className="stall-form" onSubmit={submit}>
          <label className="field">
            Warung
            <select value={stallId} onChange={(event) => setStallId(Number(event.target.value))} required>
              {stalls.map((stall) => <option value={stall.id} key={stall.id}>{stall.name}</option>)}
            </select>
          </label>
          <label className="field">
            Nama menu
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required />
          </label>
          <label className="field">
            Harga (Rp)
            <input type="number" value={price} onChange={(event) => setPrice(event.target.value)} min="0" step="1" required />
          </label>
          <label className="check-field">
            <input type="checkbox" checked={isAvailable} onChange={(event) => setIsAvailable(event.target.checked)} />
            Tersedia untuk dipesan
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="button button-light" onClick={onClose}>Batal</button>
            <button className="button button-dark" disabled={busy || stalls.length === 0}>
              {busy ? 'Menyimpan…' : 'Simpan menu'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
