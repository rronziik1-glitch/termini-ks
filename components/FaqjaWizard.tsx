'use client';
// Faqja Gati wizard (01-product-design.md §6.1 steps 2–4): business → text → photos + phone → build.
// Photos are made smaller on the phone before upload (max 2000px JPEG), then sent one by one.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ApiError, Field, Icon, PhoneInput, api, toastError } from '@/components/ui';
import { normalizePhone } from '@/lib/phone';
import { sq } from '@/lib/sq';

const t = sq.fg;
const TYPES = ['berber', 'klinike-dentare', 'restorant-kafe', 'bujtine', 'salon-bukurie', 'dyqan', 'auto'];
const MAX = 10;
type Photo = { key: number; file: File; url: string };
type Prefill = { name: string; city: string; template: string; phone: string; text: string };
let seq = 1;

/** Downscale on the device; falls back to the original file when the browser cannot decode it (e.g. HEIC). */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 2.5e6 && file.type === 'image/jpeg') return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
    return blob || file;
  } catch {
    return file;
  }
}

export default function FaqjaWizard({ prefill }: { prefill: Prefill }) {
  const router = useRouter();
  const known = !!prefill.name && !!prefill.template;
  const [step, setStep] = useState(known ? 2 : 1);
  const [template, setTemplate] = useState(prefill.template || '');
  const [name, setName] = useState(prefill.name);
  const [city, setCity] = useState(prefill.city && sq.cities.includes(prefill.city) ? prefill.city : sq.cities[0]);
  const [text, setText] = useState(prefill.text);
  const [oldUrl, setOldUrl] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [phone, setPhone] = useState(prefill.phone);
  const [errors, setErrors] = useState<{ template?: string; name?: string; text?: string; phone?: string; photos?: string }>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []);   // eslint-disable-line react-hooks/exhaustive-deps

  const igUrl = /instagram\.com|facebook\.com|fb\.com/i.test(oldUrl);

  function next() {
    if (step === 1) {
      const e: typeof errors = {};
      if (!template) e.template = t.w1Text;
      if (name.trim().length < 2) e.name = sq.errors.business_name;
      setErrors(e);
      if (Object.keys(e).length) return;
      setStep(2);
    } else if (step === 2) {
      const sentences = text.trim().split(/[.!?\n]+/).filter((s) => s.trim().length > 2);
      if (text.trim().length < 20 || sentences.length < 2) { setErrors({ text: t.aboutError }); return; }
      setErrors({});
      setStep(3);
    } else build();
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (files.length < list.length) setErrors((e) => ({ ...e, photos: sq.errors.photo_type }));
    else setErrors((e) => ({ ...e, photos: undefined }));
    const room = MAX - photos.length;
    if (files.length > room) setErrors((e) => ({ ...e, photos: sq.errors.photo_max }));
    setPhotos((p) => [...p, ...files.slice(0, room).map((file) => ({ key: seq++, file, url: URL.createObjectURL(file) }))]);
    if (fileInput.current) fileInput.current.value = '';
  }
  const removePhoto = (key: number) => setPhotos((p) => { const x = p.find((y) => y.key === key); if (x) URL.revokeObjectURL(x.url); return p.filter((y) => y.key !== key); });
  const makeFirst = (key: number) => setPhotos((p) => [...p.filter((y) => y.key === key), ...p.filter((y) => y.key !== key)]);

  async function build() {
    if (!normalizePhone(phone)) { setErrors({ phone: sq.errors.invalid_phone }); return; }
    setErrors({});
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>('/pages', { body: { template, name, city, text, old_url: oldUrl, contact_phone: phone } });
      for (let i = 0; i < photos.length; i++) {
        setProgress(t.uploading(i + 1, photos.length));
        const form = new FormData();
        form.append('file', await shrink(photos[i].file), photos[i].file.name.replace(/\.\w+$/, '') + '.jpg');
        try { await api(`/pages/${id}/assets`, { form }); } catch (e) { if (!(e instanceof ApiError && e.code === 'photo_type')) throw e; }
      }
      setProgress('');
      await api(`/pages/${id}/generate`, { body: {} });
      router.push(`/faqja/${id}`);
    } catch (e) {
      setBusy(false); setProgress('');
      if (e instanceof ApiError && e.code === 'invalid_phone') setErrors({ phone: e.message });
      else if (e instanceof ApiError && e.code === 'about_short') { setStep(2); setErrors({ text: e.message }); }
      else if (e instanceof ApiError && e.code === 'business_name') { setStep(1); setErrors({ name: e.message }); }
      else toastError(e);
    }
  }

  const H = (id: string, txt: string) => <h1 className="t-h1" id={id} ref={heading} tabIndex={-1} style={{ outline: 0 }}>{txt}</h1>;
  const label = step < 3 ? sq.common.next : progress || (photos.length ? t.build : t.buildNoPhotos);

  return (
    <div className="page">
      <div className="app app--bar">
        <header className="topbar">
          {step > 1 ? <button className="iconbtn" onClick={() => setStep(step - 1)} aria-label={sq.common.back} disabled={busy}><Icon name="chevron-left" /></button>
            : <Link className="iconbtn" href="/faqja" aria-label={sq.common.back}><Icon name="chevron-left" /></Link>}
          <div className="steps" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} aria-label={sq.common.step}>
            {[1, 2, 3].map((n) => <span key={n} className={n <= step ? 'is-done' : ''} />)}
          </div>
          <span className="t-caption t-3 t-num" style={{ minWidth: 32, textAlign: 'right' }}>{step} / 3</span>
        </header>

        <main className="app__pad">
          {step === 1 && (
            <section aria-labelledby="w1">
              <div className="stack stack--6" style={{ paddingTop: 16 }}>
                <div className="stack stack--2">{H('w1', t.w1)}<p className="t-2">{t.w1Text}</p></div>
                <div className="tpl" role="group" aria-labelledby="w1">
                  {TYPES.map((k) => <button key={k} type="button" className={template === k ? 'is-selected' : ''} aria-pressed={template === k} onClick={() => { setTemplate(k); setErrors((e) => ({ ...e, template: undefined })); }}>{t.templates[k]}</button>)}
                </div>
                {errors.template && <p className="note note--danger" role="alert">{errors.template}</p>}
                <Field label={t.name} htmlFor="fn" error={errors.name}>
                  <input className="input" id="fn" autoComplete="organization" placeholder={t.namePh} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name || undefined} />
                </Field>
                <Field label={t.city} htmlFor="fc">
                  <select className="input" id="fc" value={city} onChange={(e) => setCity(e.target.value)}>
                    {sq.cities.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="w2">
              <form className="stack stack--6" style={{ paddingTop: 16 }} noValidate onSubmit={(e) => { e.preventDefault(); next(); }}>
                <div className="stack stack--2">{H('w2', t.w2)}<p className="t-2">{t.w2Text}</p></div>
                <Field label={t.about} htmlFor="ft" error={errors.text}>
                  <textarea className="input" id="ft" rows={7} maxLength={4000} placeholder={t.placeholders[template] || t.placeholders.auto} value={text} onChange={(e) => { setText(e.target.value); setErrors({}); }} aria-invalid={!!errors.text || undefined} />
                </Field>
                <Field label={t.oldUrl} small={sq.common.optional} htmlFor="fu" hint={t.oldUrlHint}>
                  <input className="input" id="fu" inputMode="url" autoCapitalize="none" autoComplete="url" placeholder={t.oldUrlPh} value={oldUrl} maxLength={300} onChange={(e) => setOldUrl(e.target.value)} />
                </Field>
                {igUrl && <p className="note note--warn" role="status">{t.oldUrlHint}</p>}
                <button type="submit" hidden />
              </form>
            </section>
          )}

          {step === 3 && (
            <section aria-labelledby="w3">
              <form className="stack stack--6" style={{ paddingTop: 16, paddingBottom: 24 }} noValidate onSubmit={(e) => { e.preventDefault(); next(); }}>
                <div className="stack stack--2">{H('w3', t.w3)}<p className="t-2">{t.w3Text}</p></div>
                <div className="thumbs">
                  {photos.map((p, i) => (
                    <figure className="thumb" key={p.key}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={t.photoN(i + 1)} />
                      <button type="button" className="thumb__x" onClick={() => removePhoto(p.key)} aria-label={t.removePhoto(i + 1)} disabled={busy}><Icon name="x" size="sm" /></button>
                      {i === 0 ? <span className="badge badge--ok thumb__main">{t.mainPhoto}</span>
                        : <button type="button" className="thumb__make" onClick={() => makeFirst(p.key)} disabled={busy}>{t.makeFirst}</button>}
                    </figure>
                  ))}
                  {photos.length < MAX && (
                    <label className="thumb thumb--add">
                      <Icon name="image" />
                      <span>{t.addPhotos}</span>
                      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr" onChange={(e) => addFiles(e.target.files)} disabled={busy} />
                    </label>
                  )}
                </div>
                {errors.photos && <p className="note note--danger" role="alert">{errors.photos}</p>}
                <p className="t-small t-3">{t.tips}</p>
                <Field label={t.contactPhone} htmlFor="fp" error={errors.phone} hint={t.contactHint}>
                  <PhoneInput id="fp" value={phone} onChange={(v) => { setPhone(v); setErrors({}); }} placeholder={sq.onboarding.phonePh} invalid={!!errors.phone} />
                </Field>
                <button type="submit" hidden />
              </form>
            </section>
          )}
        </main>
      </div>

      <div className="bar is-visible">
        <div className="bar__in">
          <button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy} onClick={next}>{label}</button>
        </div>
      </div>
    </div>
  );
}
