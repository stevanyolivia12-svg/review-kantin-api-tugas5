import { useState, type FormEvent } from 'react';
import { createStall, updateStall } from './api';
import type { Stall, StallInput } from './types';

const emptyStall: StallInput = {
  name: '',
  category: '',
  location: '',
  description: '',
};

export function StallFormDialog({
  stall,
  token,
  onClose,
  onSaved,
}: {
  stall: Stall | null;
  token: string;
  onClose: () => void;
  onSaved: (stall: Stall) => void;
}) {
  const [form, setForm] = useState<StallInput>(
    stall
      ? {
          name: stall.name,
          category: stall.category ?? '',
          location: stall.location ?? '',
          description: stall.description ?? '',
        }
      : emptyStall,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof StallInput>(field: K, value: StallInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const input = {
        name: form.name.trim(),
        category: form.category?.trim() || null,
        location: form.location?.trim() || null,
        description: form.description?.trim() || null,
      };
      const saved = stall
        ? await updateStall(stall.id, input, token)
        : await createStall(input, token);
      onSaved(saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Warung tidak dapat disimpan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="panel dialog" role="dialog" aria-modal="true" aria-labelledby="stall-form-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Tutup form">×</button>
        <span className="eyebrow">{stall ? 'PERBARUI INFORMASI' : 'TAMBAHKAN TEMPAT BARU'}</span>
        <h2 id="stall-form-title">{stall ? 'Edit warung' : 'Warung baru'}</h2>
        <p className="muted">Informasi ini akan disimpan ke backend.</p>
        <form className="stall-form" onSubmit={submit}>
          <label className="field">
            Nama warung
            <input value={form.name} onChange={(event) => setField('name', event.target.value)} maxLength={100} required />
          </label>
          <div className="field-row">
            <label className="field">
              Kategori
              <input value={form.category ?? ''} onChange={(event) => setField('category', event.target.value)} maxLength={50} placeholder="Contoh: Makanan" />
            </label>
            <label className="field">
              Lokasi
              <input value={form.location ?? ''} onChange={(event) => setField('location', event.target.value)} maxLength={100} placeholder="Contoh: Kantin Utama" />
            </label>
          </div>
          <label className="field">
            Cerita singkat
            <textarea value={form.description ?? ''} onChange={(event) => setField('description', event.target.value)} maxLength={4000} rows={4} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="button button-light" onClick={onClose}>Batal</button>
            <button className="button button-dark" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan warung'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
