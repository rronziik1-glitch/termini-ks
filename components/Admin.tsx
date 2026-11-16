'use client';
// Faqja Gati pages for the Super Admin panel (status filter, mark paid, publish/unpublish, send preview, edit content,
// replace photos). Uses /api/admin/pages* (§8.5). v6: the panel itself is components/SuperAdmin.tsx.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Field, Icon, Sheet, api, toast, toastError } from '@/components/ui';
import { sq } from '@/lib/sq';

const t = sq.admin;
type AdminPage = {
  id: string; name: string; city: string; template: string; status: string; createdAt: string; contactPhone: string; contactDisplay: string;
  text: string; oldUrl: string; notice: string; subdomain: string | null; customDomain: string | null; liveUrl: string; previewUrl: string;
  revisionsUsed: number; content: string; business: { slug: string; name: string } | null;
  payments: { id: string; method: string; status: string; amountCents: number; reference: string; paidAt: string | null }[];
  assets: { id: string; url: string; kind: string }[];
  generations: { model: string; ok: boolean; error: string; inputTokens: number; outputTokens: number; durationMs: number; note: string }[];
};

const STATUSES = ['', 'preview', 'payment_pending', 'live', 'paid', 'generating', 'failed', 'expired'];
const eur = (c: number) => `${(c / 100).toLocaleString('de-DE')} €`;
const date = (iso: string) => new Date(iso).toLocaleDateString('sq-AL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const badge = (s: string) => (s === 'live' ? 'badge--ok' : s === 'payment_pending' ? 'badge--new' : s === 'failed' || s === 'expired' ? 'badge--danger' : s === 'preview' ? 'badge--info' : '');

/** v6: the Faqja Gati pages tab of the Super Admin panel (only shown while Faqja Gati is switched on). */
export function FgPagesTab({ priceCents }: { priceCents: number }) {
  const [filter, setFilter] = useState('');
  const [pages, setPages] = useState<AdminPage[] | null>(null);
  const [open, setOpen] = useState<string>('');
  const [paying, setPaying] = useState<AdminPage | null>(null);
  const [method, setMethod] = useState('bank');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ pages: AdminPage[] }>(`/admin/pages${filter ? `?status=${filter}` : ''}`).then((r) => setPages(r.pages)).catch(toastError);
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  async function markPaid() {
    if (!paying) return;
    setBusy(true);
    try {
      await api(`/admin/pages/${paying.id}/mark-paid`, { body: { method, note } });
      toast(t.paidToast); setPaying(null); setNote(''); load();
    } catch (e) { toastError(e); }
    setBusy(false);
  }
  async function act(p: AdminPage, path: 'publish' | 'unpublish') {
    try { await api(`/admin/pages/${p.id}/${path}`, { body: {} }); toast(path === 'unpublish' ? t.unpublished : sq.common.saved); load(); } catch (e) { toastError(e); }
  }
  function openPay(p: AdminPage) {
    const pending = p.payments.find((x) => x.status === 'pending');
    setMethod(pending?.method === 'paysera' ? 'paysera' : pending?.method || 'bank');
    setNote(''); setPaying(p);
  }

  return (
    <>
              <div className="chips chips--wrap" role="group" aria-label={t.status.preview}>
                {STATUSES.map((s) => <button key={s || 'all'} className={`chip${filter === s ? ' is-selected' : ''}`} aria-pressed={filter === s} onClick={() => { setPages(null); setFilter(s); }}>{s ? t.status[s] : t.all}</button>)}
              </div>
              {pages === null ? <div className="skeleton" style={{ height: 240 }} />
                : pages.length === 0 ? <section className="card empty"><p className="empty__title">{t.noPages}</p></section>
                : (
                  <div className="admin-grid">
                    {pages.map((p) => {
                      const paid = p.payments.find((x) => x.status === 'paid');
                      const pending = p.payments.find((x) => x.status === 'pending');
                      const pay = paid || pending;
                      return (
                        <article className="card admin-card" key={p.id}>
                          <div className="split">
                            <div>
                              <p className="t-h3">{p.name}</p>
                              <p className="t-small t-3">{sq.fg.templates[p.template] || p.template} · {p.city}{p.business ? ` · ${sq.brand.termini}: ${p.business.slug}` : ''}</p>
                            </div>
                            <span className={`badge ${badge(p.status)}`}>{t.status[p.status] || p.status}</span>
                          </div>
                          <dl>
                            <div className="kv"><dt>{t.contact}</dt><dd className="t-num">{p.contactDisplay}</dd></div>
                            <div className="kv"><dt>{t.created}</dt><dd>{date(p.createdAt)}</dd></div>
                            <div className="kv"><dt>{t.payment}</dt><dd>{pay ? `${t.method[pay.method] || pay.method} · ${eur(pay.amountCents)} · ${pay.reference}${paid ? ' ✓' : ''}` : t.noPayment}</dd></div>
                            {p.subdomain && <div className="kv"><dt>{sq.fg.address}</dt><dd className="t-num">{p.subdomain}{p.customDomain ? ` · ${p.customDomain}` : ''}</dd></div>}
                          </dl>
                          <div className="admin-card__actions">
                            {['preview', 'payment_pending', 'paid', 'live'].includes(p.status) && <a className="btn btn--secondary btn--sm" href={`/faqja/${p.id}/parapamja`} target="_blank" rel="noopener noreferrer"><Icon name="eye" size="sm" />{t.openPreview}</a>}
                            {p.status === 'live' && p.liveUrl && <a className="btn btn--secondary btn--sm" href={p.liveUrl} target="_blank" rel="noopener noreferrer"><Icon name="external" size="sm" />{t.openLive}</a>}
                            {['preview', 'payment_pending'].includes(p.status) && (
                              <>
                                <a className="btn btn--whatsapp btn--sm" href={`https://wa.me/${p.contactPhone.replace(/\D/g, '')}?text=${encodeURIComponent(sq.wa.previewReady(p.previewUrl))}`} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />{t.sendPreview}</a>
                                <button className="btn btn--primary btn--sm" onClick={() => openPay(p)}>{t.markPaid}</button>
                              </>
                            )}
                            {p.status === 'live' && <button className="btn btn--ghost btn--sm" onClick={() => act(p, 'unpublish')}>{t.unpublish}</button>}
                            {p.status === 'paid' && <button className="btn btn--primary btn--sm" onClick={() => act(p, 'publish')}>{t.publish}</button>}
                            <button className="btn btn--ghost btn--sm" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? '' : p.id)}>{t.details}<Icon name={open === p.id ? 'chevron-up' : 'chevron-down'} size="sm" /></button>
                          </div>
                          {open === p.id && <Details page={p} onSaved={load} />}
                        </article>
                      );
                    })}
                  </div>
                )}

      <Sheet open={!!paying} onClose={() => setPaying(null)} title={t.markPaidTitle} closeButton
        actions={<button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy} onClick={markPaid}>{t.confirmPaid}</button>}>
        <div className="stack">
          <p className="t-2">{paying?.name} · {eur(paying?.payments.find((x) => x.status === 'pending')?.amountCents || priceCents)}. {t.markPaidText}</p>
          <div className="stack stack--3">
            <p className="field__label" id="pm-l">{t.methodLabel}</p>
            <div className="segmented" role="group" aria-labelledby="pm-l">
              {['bank', 'cash', 'paysera'].map((m) => <button key={m} className={method === m ? 'is-selected' : ''} aria-pressed={method === m} onClick={() => setMethod(m)}>{t.method[m]}</button>)}
            </div>
          </div>
          <Field label={t.note} small={sq.common.optional} htmlFor="pn">
            <input className="input" id="pn" placeholder={t.notePh} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </Sheet>
    </>
  );
}

/** Owner input, content JSON editor, photo replacement and generation log for one page. */
function Details({ page, onSaved }: { page: AdminPage; onSaved: () => void }) {
  const [json, setJson] = useState(() => { try { return JSON.stringify(JSON.parse(page.content || '{}'), null, 2); } catch { return page.content; } });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState('');

  async function save() {
    setBusy(true); setErr('');
    try { await api(`/admin/pages/${page.id}/content`, { method: 'PUT', body: { content: json } }); toast(t.contentSaved); onSaved(); }
    catch (e) { setErr(e instanceof Error ? e.message : sq.common.failed); }
    setBusy(false);
  }
  async function replace(f: File | undefined) {
    if (!f || !replacing) return;
    const form = new FormData(); form.append('file', f);
    try { await api(`/admin/pages/${page.id}/assets/${replacing}/replace`, { form }); toast(t.replaced); onSaved(); } catch (e) { toastError(e); }
    setReplacing(''); if (file.current) file.current.value = '';
  }

  return (
    <div className="stack" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
      <div className="stack stack--2">
        <p className="label-caps">{t.input}</p>
        <p className="t-small pre">{page.text}</p>
        {page.oldUrl && <p className="t-small t-3">{page.oldUrl}</p>}
      </div>
      <div className="stack stack--2">
        <p className="label-caps">{t.photos}</p>
        {page.assets.length === 0 ? <p className="t-small t-3">{t.noPhotos}</p> : (
          <div className="admin-photos">
            {page.assets.map((a) => (
              <figure key={a.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${a.url}?k=${a.kind}`} alt="" />
                <button className="btn btn--secondary btn--sm" onClick={() => { setReplacing(a.id); file.current?.click(); }}>{t.replace}</button>
              </figure>
            ))}
          </div>
        )}
        <input ref={file} type="file" accept="image/*" className="sr" onChange={(e) => replace(e.target.files?.[0])} />
      </div>
      {page.content && (
        <Field label={t.content} hint={t.contentHint}>
          <textarea className="input admin-json" spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)} aria-label={t.content} />
        </Field>
      )}
      {err && <p className="note note--danger pre" role="alert">{err}</p>}
      {page.content && <button className={`btn btn--primary btn--sm btn--auto${busy ? ' is-loading' : ''}`} disabled={busy} onClick={save}>{sq.common.save}</button>}
      {page.generations.length > 0 && (
        <div className="stack stack--2">
          <p className="label-caps">{t.generations}</p>
          <ul className="t-small t-2">
            {page.generations.map((g, i) => <li key={i} className="t-num">{g.ok ? '✓' : '✗'} {g.model} · {g.inputTokens}/{g.outputTokens} tok · {(g.durationMs / 1000).toFixed(1)} s{g.note ? ` · "${g.note}"` : ''}{g.error ? ` · ${g.error}` : ''}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
