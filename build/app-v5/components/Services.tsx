'use client';
// Shërbimet (fable/termini-ui/services.html). The switch saves at once; everything else is saved from the sheet.
import { useEffect, useState } from 'react';
import { ApiError, Field, Icon, Sheet, Switch, api, toast, toastError } from '@/components/ui';
import { sq } from '@/lib/sq';
import { fmtDuration, fmtPrice } from '@/lib/time';

const t = sq.services;
type Service = { id: string; name: string; description: string; durationMin: number; priceCents: number | null; priceFrom: boolean; active: boolean; futureBookings: number };
type Form = { id: string; name: string; duration: number; custom: boolean; customMin: string; price: string; priceFrom: boolean; description: string };
const PRESET = t.durations.map((d) => d[0]);
const blank: Form = { id: '', name: '', duration: 30, custom: false, customMin: '', price: '', priceFrom: false, description: '' };

export default function Services({ slug }: { slug: string }) {
  const [list, setList] = useState<Service[] | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [sheet, setSheet] = useState<'' | 'edit' | 'delete'>('');
  const [nameErr, setNameErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<{ services: Service[] }>('/services').then((r) => setList(r.services)).catch(toastError); }, []);
  const apply = (r: { services: Service[] }) => setList(r.services);
  const editing = list?.find((s) => s.id === form.id);

  function openEdit(s?: Service) {
    setNameErr('');
    setForm(s ? {
      id: s.id, name: s.name, duration: s.durationMin, custom: !PRESET.includes(s.durationMin), customMin: PRESET.includes(s.durationMin) ? '' : String(s.durationMin),
      price: s.priceCents === null ? '' : String(s.priceCents / 100).replace('.', ','), priceFrom: s.priceFrom, description: s.description,
    } : blank);
    setSheet('edit');
  }

  async function save() {
    if (form.name.trim().length < 2) { setNameErr(sq.errors.service_name); document.getElementById('sn')?.focus(); return; }
    const body = { name: form.name, durationMin: form.custom ? Number(form.customMin) || 30 : form.duration, price: form.price, priceFrom: form.priceFrom && !!form.price, description: form.description };
    setBusy(true);
    try {
      apply(await api(form.id ? `/services/${form.id}` : '/services', { method: form.id ? 'PATCH' : 'POST', body }));
      setSheet(''); toast(t.savedOne);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'service_name') setNameErr(e.message); else toastError(e);
    }
    setBusy(false);
  }

  async function toggle(s: Service, active: boolean, silent = false) {
    setList((l) => l && l.map((x) => (x.id === s.id ? { ...x, active } : x)));          // optimistic
    try {
      apply(await api(`/services/${s.id}`, { method: 'PATCH', body: { active } }));
      if (!silent) toast(active ? t.turnedOn : t.turnedOff, { action: sq.common.undo, onAction: () => toggle(s, !active, true) });
    } catch (e) { toastError(e); setList((l) => l && l.map((x) => (x.id === s.id ? { ...x, active: !active } : x))); }
  }

  async function remove() {
    const id = form.id;
    setSheet('');
    try {
      apply(await api(`/services/${id}`, { method: 'DELETE' }));
      toast(t.deleted, { action: sq.common.undo, onAction: () => api<{ services: Service[] }>(`/services/${id}`, { method: 'PATCH', body: { deleted: false } }).then(apply).catch(toastError) });
    } catch (e) { toastError(e); }
  }

  async function moveBy(i: number, by: number) {
    if (!list) return;
    const next = [...list];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item);
    setList(next);
    try { apply(await api('/services/order', { method: 'PUT', body: { ids: next.map((s) => s.id) } })); } catch (e) { toastError(e); }
  }

  return (
    <>
      <div className="app app--tabs">
        <header className="topbar">
          <h1 className="t-h2 grow">{t.title}</h1>
          <button className="btn btn--primary btn--sm btn--auto" onClick={() => openEdit()}><Icon name="plus" size="sm" />{t.add}</button>
        </header>

        {list === null ? (
          <main className="app__pad" style={{ paddingTop: 12 }}><div className="skeleton" style={{ height: 320 }} /></main>
        ) : list.length === 0 ? (
          <main className="app__pad" style={{ paddingTop: 12 }}>
            <section className="card empty">
              <p className="empty__title">{t.emptyTitle}</p>
              <p className="empty__text">{t.emptyText}</p>
              <button className="btn btn--primary" onClick={() => openEdit()}>{t.addService}</button>
            </section>
          </main>
        ) : (
          <main className="app__pad stack" style={{ paddingTop: 12 }}>
            <p className="t-small t-2">{t.intro} <a className="link" href={`/b/${slug}`} target="_blank" rel="noopener noreferrer">{t.seePage}</a></p>
            <ul className="list--card">
              {list.map((s, i) => (
                <li className={`row${s.active ? '' : ' is-off'}`} key={s.id}>
                  <span style={{ display: 'flex', flexDirection: 'column', marginLeft: -8 }}>
                    <button className="iconbtn" style={{ height: 44, width: 44 }} disabled={i === 0} aria-label={t.moveUp(s.name)} onClick={() => moveBy(i, -1)}><Icon name="chevron-up" size="sm" style={{ opacity: i === 0 ? 0.25 : 0.7 }} /></button>
                    <button className="iconbtn" style={{ height: 44, width: 44 }} disabled={i === list.length - 1} aria-label={t.moveDown(s.name)} onClick={() => moveBy(i, 1)}><Icon name="chevron-down" size="sm" style={{ opacity: i === list.length - 1 ? 0.25 : 0.7 }} /></button>
                  </span>
                  <button className="row__tap" onClick={() => openEdit(s)}>
                    <span className="row__main"><span className="row__title">{s.name}</span><span className="row__meta">{[fmtDuration(s.durationMin), s.description].filter(Boolean).join(' · ')}</span></span>
                    <span className="row__price">{s.priceCents === null ? '' : fmtPrice(s.priceCents, s.priceFrom)}</span>
                  </button>
                  <Switch checked={s.active} onChange={(v) => toggle(s, v)} label={t.bookable(s.name)} />
                </li>
              ))}
            </ul>
            <p className="t-small t-3 t-center">{t.offHint}</p>
          </main>
        )}
      </div>

      <Sheet open={sheet === 'edit'} onClose={() => setSheet('')} title={form.id ? editing?.name || form.name : t.newTitle} closeButton
        actions={<button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy} onClick={save}>{sq.common.save}</button>}>
        <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Field label={t.name} htmlFor="sn" error={nameErr}>
            <input className="input" id="sn" autoComplete="off" placeholder={t.namePh} value={form.name} maxLength={60} onChange={(e) => { setForm({ ...form, name: e.target.value }); setNameErr(''); }} aria-invalid={!!nameErr || undefined} />
          </Field>
          <div className="stack stack--3">
            <p className="field__label" id="dur-l">{t.howLong}</p>
            <div className="chips chips--wrap" role="group" aria-labelledby="dur-l">
              {t.durations.map(([min, label]) => <button type="button" key={min} className={`chip${!form.custom && form.duration === min ? ' is-selected' : ''}`} aria-pressed={!form.custom && form.duration === min} onClick={() => setForm({ ...form, duration: min, custom: false })}>{label}</button>)}
              <button type="button" className={`chip${form.custom ? ' is-selected' : ''}`} aria-pressed={form.custom} onClick={() => setForm({ ...form, custom: true })}>{sq.common.other}</button>
            </div>
            {form.custom && (
              <label className="inputgroup">
                <span className="sr">{t.customMin}</span>
                <input className="input t-num" inputMode="numeric" placeholder="75" autoFocus value={form.customMin} onChange={(e) => setForm({ ...form, customMin: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
                <span className="inputgroup__ad inputgroup__ad--end">{sq.common.min}</span>
              </label>
            )}
          </div>
          <Field label={t.price} small={t.priceIf} htmlFor="sp" hint={t.priceHint}>
            <div className="inputgroup">
              <input className="input t-num" id="sp" inputMode="decimal" placeholder="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^\d.,]/g, '').slice(0, 7) })} />
              <span className="inputgroup__ad inputgroup__ad--end">€</span>
            </div>
          </Field>
          <label className="check" style={{ marginTop: -8 }}><input type="checkbox" checked={form.priceFrom} onChange={(e) => setForm({ ...form, priceFrom: e.target.checked })} />{t.priceFrom(form.price)}</label>
          <Field label={t.desc} small={sq.common.optional} htmlFor="sd">
            <textarea className="input" id="sd" rows={2} maxLength={80} placeholder={t.descPh} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          {form.id && <button type="button" className="btn btn--ghost btn--sm" style={{ color: 'var(--danger)' }} onClick={() => setSheet('delete')}><Icon name="trash" size="sm" />{t.delete}</button>}
          <button type="submit" hidden />
        </form>
      </Sheet>

      <Sheet open={sheet === 'delete'} onClose={() => setSheet('')} title={t.deleteTitle}
        actions={<>
          <button className="btn btn--danger" onClick={remove}>{t.yesDelete}</button>
          <button className="btn btn--secondary" onClick={() => setSheet('')}>{t.noKeep}</button>
        </>}>
        <p className="t-2">{editing && editing.futureBookings > 0 ? t.deleteWith(editing.futureBookings) : t.deleteWithout}</p>
      </Sheet>
    </>
  );
}
