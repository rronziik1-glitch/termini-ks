'use client';
// Klientët (01-product-design.md §4.3): built from bookings; search, history, note, block a number.
import { useEffect, useState } from 'react';
import { Field, Icon, Sheet, api, toast, toastError } from '@/components/ui';
import { sq } from '@/lib/sq';
import { fmtDateLong, fmtDayMonth, fmtPrice } from '@/lib/time';

const t = sq.customers;
type Row = { id: string; name: string; phone: string; phoneDisplay: string; visits: number; noShows: number; blocked: boolean; lastVisit: string | null };
type Detail = Row & { note: string; history: { id: string; date: string; time: string; service: string; priceCents: number | null; status: string; upcoming: boolean }[] };

const statusBadge = (h: Detail['history'][number]) =>
  h.status === 'no_show' ? <span className="badge badge--danger">{sq.calendar.noShowBadge}</span>
    : h.status.startsWith('cancelled') ? <span className="badge">{sq.calendar.statusCancelled}</span>
      : h.upcoming ? <span className="badge badge--info">{t.upcoming}</span>
        : <span className="badge badge--ok">{sq.calendar.statusDone}</span>;

export default function Customers() {
  const [q, setQ] = useState('');
  const [list, setList] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  const load = (query: string) => api<{ customers: Row[]; total: number }>(`/customers?q=${encodeURIComponent(query)}`).then((r) => { setList(r.customers); setTotal(r.total); }).catch(toastError);
  useEffect(() => { const timer = setTimeout(() => load(q), q ? 250 : 0); return () => clearTimeout(timer); }, [q]);

  async function show(id: string) {
    try { const d = await api<Detail>(`/customers/${id}`); setDetail(d); setNote(d.note); setOpen(true); } catch (e) { toastError(e); }
  }
  async function saveNote() {
    if (!detail || note === detail.note) return;
    try { await api(`/customers/${detail.id}`, { method: 'PATCH', body: { note } }); setDetail({ ...detail, note }); toast(sq.common.saved); } catch (e) { toastError(e); }
  }
  async function toggleBlock() {
    if (!detail) return;
    const blocked = !detail.blocked;
    try {
      const res = await api<{ cancelled?: number }>(`/customers/${detail.id}`, { method: 'PATCH', body: { blocked } });
      setDetail({ ...detail, blocked }); load(q);
      toast(blocked ? (res?.cancelled ? t.blockedCancelled(res.cancelled) : t.blockedToast) : t.unblockedToast);
    } catch (e) { toastError(e); }
  }

  const d = detail;
  return (
    <>
      <div className="app app--tabs">
        <header className="topbar"><h1 className="t-h2 grow">{t.title}</h1>{list && total > 0 && <span className="t-small t-3 t-num">{total}</span>}</header>
        <main className="app__pad stack" style={{ paddingTop: 12 }}>
          {(total > 0 || q) && (
            <label className="field"><span className="sr">{t.search}</span>
              <input className="input" type="search" placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
            </label>
          )}
          {list === null ? <div className="skeleton" style={{ height: 240 }} />
            : list.length === 0 ? <section className="card empty"><p className="empty__title">{q ? t.noResults : t.empty}</p></section>
              : (
                <ul className="list--card">
                  {list.map((c) => (
                    <li key={c.id}>
                      <button className="row" onClick={() => show(c.id)}>
                        <span className="avatar" aria-hidden="true">{c.name.charAt(0).toUpperCase()}</span>
                        <span className="row__main">
                          <span className="row__title">{c.name}</span>
                          <span className="row__meta">{[c.phoneDisplay || sq.calendar.walkIn, c.lastVisit ? t.lastVisit(fmtDayMonth(c.lastVisit)) : t.noVisit].join(' · ')}</span>
                        </span>
                        {c.blocked ? <span className="badge badge--danger">{t.blockedBadge}</span> : c.noShows > 0 ? <span className="badge badge--danger">{sq.calendar.noShows(c.noShows)}</span> : <span className="badge">{sq.calendar.visits(c.visits)}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
        </main>
      </div>

      <Sheet open={open && !!d} onClose={() => { saveNote(); setOpen(false); }} title={d?.name || ''}
        head={{
          before: <span className="avatar avatar--lg" aria-hidden="true">{d?.name.charAt(0).toUpperCase()}</span>,
          sub: d && <p className="cluster t-small t-2"><span className="t-num">{d.phoneDisplay || sq.calendar.walkIn}</span><span>· {sq.calendar.visits(d.visits)}</span>{d.noShows > 0 && <span className="badge badge--danger">{sq.calendar.noShows(d.noShows)}</span>}{d.blocked && <span className="badge badge--danger">{t.blockedBadge}</span>}</p>,
          after: d?.phone ? <a className="iconbtn iconbtn--fill" href={`tel:${d.phone}`} aria-label={sq.calendar.callName(d.name)}><Icon name="phone" /></a> : undefined,
        }}
        actions={d && (
          <>
            {d.phone && <button className={`btn ${d.blocked ? 'btn--secondary' : 'btn--danger'}`} onClick={toggleBlock}>{d.blocked ? t.unblock : t.block}</button>}
            <button className="btn btn--secondary" onClick={() => { saveNote(); setOpen(false); }}>{sq.common.close}</button>
          </>
        )}>
        {d && (
          <div className="stack stack--6">
            <Field label={t.note} htmlFor="cnote">
              <textarea className="input" id="cnote" rows={2} maxLength={500} placeholder={t.notePh} value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} />
            </Field>
            <div className="stack stack--2">
              <p className="label-caps">{t.history}</p>
              <dl className="summary" style={{ paddingBlock: 0 }}>
                {d.history.map((h) => (
                  <div className="summary__row" key={h.id} style={{ alignItems: 'center' }}>
                    <dt><span className="t-num" style={{ color: 'var(--text)' }}>{fmtDateLong(h.date)} · {h.time}</span><br />{h.service}{h.priceCents !== null ? ` · ${fmtPrice(h.priceCents)}` : ''}</dt>
                    <dd>{statusBadge(h)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
