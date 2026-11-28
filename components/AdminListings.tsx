'use client';
// v7 Super Admin tab "Bizneset jo në Termini": real businesses from the map, how many people wanted to book each one,
// and a one-tap WhatsApp message to the business ("5 people wanted to book you on Termini"). Plus CSV import.
import { useCallback, useEffect, useState } from 'react';
import { Field, Sheet, api, toast, toastError } from '@/components/ui';
import { sq } from '@/lib/sq';

type Row = {
  id: string; slug: string; name: string; category: string; city: string; address: string; phone: string; phoneDisplay: string;
  status: string; source: string; requestsCount: number; contactedAt: string | null; claimRequestPhone: string;
  requests: { name: string; phone: string; note: string; at: string }[];
};
type Data = { counts: { active: number; claimed: number; removed: number; withRequests: number }; listings: Row[] };
const t = sq.g;

export default function AdminListings() {
  const [filter, setFilter] = useState('requests');
  const [d, setD] = useState<Data | null>(null);
  const [importing, setImporting] = useState(false);
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api<Data>(`/admin/listings?filter=${filter}`).then(setD).catch(toastError); }, [filter]);
  useEffect(load, [load]);

  async function act(id: string, what: 'remove' | 'restore' | 'contacted') {
    try { await api(`/admin/listings/${id}/${what}`, { body: {} }); load(); } catch (e) { toastError(e); }
  }
  async function doImport() {
    setBusy(true);
    try { const r = await api<{ added: number }>('/admin/listings/import', { body: { csv } }); toast(t.importDone(r.added)); setImporting(false); setCsv(''); load(); } catch (e) { toastError(e); }
    setBusy(false);
  }
  const waTo = (r: Row) => {
    const link = `${window.location.origin}/fillo?nga=${r.slug}`;
    return `https://wa.me/${r.phone.replace(/\D/g, '')}?text=${encodeURIComponent(t.contactText({ name: r.name, n: r.requestsCount, link }))}`;
  };

  const filters: [string, string][] = [['requests', `${t.withRequests}${d ? ` (${d.counts.withRequests})` : ''}`], ['all', `${t.all}${d ? ` (${d.counts.active})` : ''}`], ['claimed', `${t.claimed}${d ? ` (${d.counts.claimed})` : ''}`], ['removed', `${t.removed}${d ? ` (${d.counts.removed})` : ''}`]];
  return (
    <section className="stack stack--4">
      <p className="t-2">{t.listingsText}</p>
      <div className="stack stack--3">
        <div className="chips chips--wrap" role="group" aria-label={t.listings}>
          {filters.map(([k, label]) => <button key={k} className={`chip${filter === k ? ' is-selected' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>)}
        </div>
        <button className="btn btn--secondary btn--sm btn--auto" style={{ alignSelf: 'flex-start' }} onClick={() => setImporting(true)}>{t.importTitle}</button>
      </div>
      {!d ? <p className="t-3">{sq.common.loading}…</p> : d.listings.length === 0 ? <p className="card empty t-2">{sq.sa.nothingYet}</p> : (
        <ul className="stack stack--3">
          {d.listings.map((r) => (
            <li key={r.id} className="card stack stack--2">
              <div className="split">
                <div className="stack stack--1">
                  <a className="row__title link" href={`/l/${r.slug}`} target="_blank" rel="noopener noreferrer">{r.name}</a>
                  <span className="t-small t-2">{sq.categoriesShort[r.category] || r.category} · {r.city}{r.address ? ` · ${r.address}` : ''}{r.phoneDisplay ? ` · ${r.phoneDisplay}` : ''}</span>
                </div>
                {r.requestsCount > 0 && <span className="badge badge--accent">{t.reqs(r.requestsCount)}</span>}
              </div>
              {r.claimRequestPhone && <p className="note note--warn t-small">{t.claimCheck(r.claimRequestPhone)}</p>}
              {r.requests.length > 0 && (
                <ul className="t-small t-2 stack stack--1">
                  {r.requests.map((q, i) => <li key={i}>{q.name} · {q.phone}{q.note ? ` · ${q.note}` : ''}</li>)}
                </ul>
              )}
              <div className="cluster">
                {r.status === 'active' && r.phone && (
                  <a className="btn btn--whatsapp btn--sm btn--auto" href={waTo(r)} target="_blank" rel="noopener noreferrer" onClick={() => act(r.id, 'contacted')}>{t.contactBiz}</a>
                )}
                {r.contactedAt && <span className="badge">{t.markContacted.replace('Shëno: ', '')}</span>}
                {r.status === 'active'
                  ? <button className="btn btn--ghost btn--sm btn--auto" onClick={() => act(r.id, 'remove')}>{t.removeListing}</button>
                  : r.status === 'removed' && <button className="btn btn--ghost btn--sm btn--auto" onClick={() => act(r.id, 'restore')}>{t.restoreListing}</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={importing} onClose={() => setImporting(false)} title={t.importTitle} closeButton
        actions={<button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy || !csv.trim()} onClick={doImport}>{sq.common.save}</button>}>
        <Field label={t.importHint} htmlFor="csv">
          <textarea id="csv" className="input" rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'Berberi Dardani; Berber; Prishtinë; Rr. UÇK 12; 049 123 456'} />
        </Field>
      </Sheet>
    </section>
  );
}
