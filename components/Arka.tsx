'use client';
// v7 owner "Arka":
//  1. Ky muaj: money this month and what Termini brought (online bookings, clients brought back, reminders)
//  2. Mesazhet: messages Termini prepared (reminder for tomorrow, bring back, how was it?) - one tap opens WhatsApp
//  3. Story: today's free times as an Instagram Story image, share with one tap
//  4. Libri i parave: mark each visit cash / card, add expenses (receipt photo), Excel + PDF, send to the accountant
//  5. Private feedback from clients
import { useCallback, useEffect, useState } from 'react';
import { Field, Icon, Sheet, api, toast, toastError } from '@/components/ui';
import { shrinkPhoto } from '@/components/shrink';
import type { MonthMoney } from '@/lib/money';
import { sq } from '@/lib/sq';
import { DAYS_SHORT, fmtDayMonth, fmtPrice, weekdayOf } from '@/lib/time';

const t = sq.g;
type Data = {
  month: string; thisMonth: string; money: MonthMoney;
  outbox: { id: string; kind: string; name: string; text: string; url: string }[];
  feedback: { id: string; rating: number; comment: string; date: string }[];
};
const eur = (c: number) => fmtPrice(c) || '0 €';
const prevMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`; };
const nextMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; };

export default function Arka({ bizName, slug }: { bizName: string; slug: string }) {
  const [month, setMonth] = useState('');
  const [d, setD] = useState<Data | null>(null);
  const load = useCallback((m = month) => { api<Data>(`/arka${m ? `?month=${m}` : ''}`).then((r) => { setD(r); if (!m) setMonth(r.month); }).catch(toastError); }, [month]);
  useEffect(() => { load(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return <main className="app__pad stack stack--5" style={{ paddingTop: 16 }}><div className="skeleton" style={{ height: 160, borderRadius: 20 }} /><div className="skeleton" style={{ height: 260, borderRadius: 20 }} /></main>;
  const m = d.money;
  const tm = m.termini;
  const go = (mm: string) => { setMonth(mm); load(mm); };

  return (
    <div className="app">
      <header className="topbar"><h1 className="t-h2 grow">{t.arkaTitle}</h1></header>
      <main className="app__pad stack stack--6" style={{ paddingTop: 8, paddingBottom: 120 }}>
        {/* month switcher */}
        <div className="split no-print">
          <button className="iconbtn" aria-label="‹" onClick={() => go(prevMonth(d.month))}><Icon name="chevron-left" /></button>
          <p className="t-h3" style={{ textTransform: 'capitalize' }}>{m.label}</p>
          <button className="iconbtn" aria-label="›" disabled={d.month >= d.thisMonth} onClick={() => go(nextMonth(d.month))}><Icon name="chevron-right" /></button>
        </div>

        {/* 1. what Termini brought */}
        <section className="card stack stack--3" aria-labelledby="tb-h">
          <p className="label-caps" id="tb-h">{t.fromTermini}</p>
          <p className="arka-num t-num">{eur(tm.onlineCents + tm.cancelledInTimeCents)}</p>
          {tm.onlineCount + tm.winbackCount + tm.reminders + tm.cancelledInTimeCount === 0 ? <p className="t-2 t-small">{t.nothingYet}</p> : (
            <ul className="stack stack--1 t-small">
              {tm.onlineCount > 0 && <li>✓ {t.online(tm.onlineCount, eur(tm.onlineCents))}</li>}
              {tm.winbackCount > 0 && <li>✓ {t.winbackLine(tm.winbackCount, eur(tm.winbackCents))}</li>}
              {tm.cancelledInTimeCount > 0 && <li>✓ {t.cancelledInTime(tm.cancelledInTimeCount, eur(tm.cancelledInTimeCents))}</li>}
              {tm.reminders > 0 && <li>✓ {t.remindersLine(tm.reminders)}</li>}
            </ul>
          )}
        </section>

        {/* 2. messages to send */}
        {d.month === d.thisMonth && <Outbox items={d.outbox} onDone={() => load(d.month)} />}

        {/* 3. Instagram story */}
        {d.month === d.thisMonth && <Story slug={slug} />}

        {/* 4. money book */}
        <MoneyBook d={d} bizName={bizName} onChange={() => load(d.month)} />

        {/* 5. private feedback */}
        <section className="stack stack--3" aria-labelledby="fb-h">
          <h2 className="t-h3" id="fb-h">{t.feedback}</h2>
          {d.feedback.length === 0 ? <p className="t-small t-2">{t.feedbackEmpty}</p> : (
            <ul className="stack stack--2">
              {d.feedback.map((f) => (
                <li key={f.id} className="card stack stack--1">
                  <span className="t-small"><b>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</b> · {fmtDayMonth(f.date)}</span>
                  {f.comment && <span className="t-2">{f.comment}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Outbox({ items, onDone }: { items: Data['outbox']; onDone: () => void }) {
  async function mark(id: string, what: 'sent' | 'skip') {
    try { await api(`/messages/${id}/${what}`, { body: {} }); if (what === 'sent') toast(t.sentToast); onDone(); } catch (e) { toastError(e); }
  }
  return (
    <section className="stack stack--3 no-print" aria-labelledby="ob-h">
      <div className="stack stack--1">
        <h2 className="t-h3" id="ob-h">{t.outbox}{items.length ? ` · ${items.length}` : ''}</h2>
        <p className="t-small t-2">{t.outboxText}</p>
      </div>
      {items.length === 0 ? <p className="t-small t-3">{t.outboxEmpty}</p> : (
        <ul className="stack stack--2">
          {items.map((m) => (
            <li key={m.id} className="card stack stack--2">
              <div className="split"><b>{m.name}</b><span className="badge">{t.kind[m.kind] || m.kind}</span></div>
              <p className="t-small t-2" style={{ whiteSpace: 'pre-line' }}>{m.text}</p>
              <div className="cluster">
                <a className="btn btn--whatsapp btn--sm btn--auto" href={m.url} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(() => mark(m.id, 'sent'), 400)}><Icon name="whatsapp" />{t.send}</a>
                <button className="btn btn--ghost btn--sm btn--auto" onClick={() => mark(m.id, 'skip')}>{t.skip}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Story({ slug }: { slug: string }) {
  const [v] = useState(() => Date.now());
  const src = `/app/story?v=${v}`;
  async function share() {
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], `termini-${slug}-story.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
      download(blob);
    } catch (e) { if ((e as Error)?.name !== 'AbortError') toastError(e); }
  }
  function download(blob?: Blob) {
    const go = (b: Blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `termini-${slug}-story.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
    if (blob) go(blob); else fetch(src).then((r) => r.blob()).then(go).catch(toastError);
  }
  return (
    <section className="stack stack--3 no-print" aria-labelledby="st-h">
      <div className="stack stack--1">
        <h2 className="t-h3" id="st-h">{t.story}</h2>
        <p className="t-small t-2">{t.storyText}</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="story-prev" src={src} alt={t.story} />
      <div className="cluster">
        <button className="btn btn--primary btn--auto" onClick={share}><Icon name="share" size="sm" />{t.storyShare}</button>
        <button className="btn btn--secondary btn--auto" onClick={() => download()}><Icon name="download" size="sm" />{t.storyDownload}</button>
      </div>
    </section>
  );
}

function MoneyBook({ d, bizName, onChange }: { d: Data; bizName: string; onChange: () => void }) {
  const m = d.money;
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('tjeter');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState<Record<string, string>>({});

  async function setMethod(id: string, method: string) {
    const prev = paid[id];
    setPaid((p) => ({ ...p, [id]: method }));
    try { await api(`/bookings/${id}/paid`, { body: { method } }); } catch (e) { setPaid((p) => ({ ...p, [id]: prev ?? '' })); toastError(e); }
  }
  async function saveExpense() {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('amount', amount); form.append('category', cat); form.append('note', note);
      form.append('date', date || (d.month === d.thisMonth ? new Date().toISOString().slice(0, 10) : `${d.month}-01`));
      if (file) form.append('receipt', await shrinkPhoto(file, 1600), 'kuponi.jpg');
      await api('/expenses', { form });
      toast(t.expenseSaved); setAdding(false); setAmount(''); setNote(''); setFile(null); onChange();
    } catch (e) { toastError(e); }
    setBusy(false);
  }
  async function delExpense(id: string) {
    try { await api(`/expenses/${id}`, { method: 'DELETE' }); toast(t.expenseDeleted); onChange(); } catch (e) { toastError(e); }
  }
  async function sendAccountant() {
    const text = t.accountantText({ biz: bizName, month: m.label, income: eur(m.totals.income), expenses: eur(m.totals.expenses), profit: eur(m.totals.profit) });
    try {
      const blob = await (await fetch(`/api/arka/export.csv?month=${d.month}`)).blob();
      const file = new File([blob], `termini-${d.month}.csv`, { type: 'text/csv' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  const tot = m.totals;
  // live totals with the taps made on this screen
  const visits = m.visits.map((v) => ({ ...v, paid: paid[v.id] ?? v.paid }));
  const byDay: { date: string; rows: typeof visits }[] = [];
  for (const v of visits) { const last = byDay[byDay.length - 1]; if (last && last.date === v.date) last.rows.push(v); else byDay.push({ date: v.date, rows: [v] }); }
  const cash = visits.filter((v) => v.paid === 'cash').reduce((s, v) => s + v.priceCents, 0);
  const card = visits.filter((v) => v.paid === 'card').reduce((s, v) => s + v.priceCents, 0);

  return (
    <section className="stack stack--4" aria-labelledby="mb-h">
      <div className="stack stack--1">
        <h2 className="t-h3" id="mb-h">{t.money}</h2>
        <p className="t-small t-2 no-print">{t.moneyText}</p>
      </div>
      <div className="arka-grid">
        <div><p className="t-caption t-3">{t.income}</p><p className="t-h3 t-num">{eur(tot.income)}</p></div>
        <div><p className="t-caption t-3">{t.expenses}</p><p className="t-h3 t-num">{eur(tot.expenses)}</p></div>
        <div><p className="t-caption t-3">{t.profit}</p><p className="t-h3 t-num">{eur(tot.profit)}</p></div>
      </div>
      <p className="t-small t-2">{t.cash}: {eur(cash)} · {t.card}: {eur(card)} · {t.unmarked}: {eur(tot.income - cash - card)}</p>
      <div className="cluster no-print">
        <a className="btn btn--secondary btn--sm btn--auto" href={`/api/arka/export.csv?month=${d.month}`}><Icon name="download" size="sm" />{t.exportCsv}</a>
        <button className="btn btn--secondary btn--sm btn--auto" onClick={() => window.print()}><Icon name="copy" size="sm" />{t.exportPdf}</button>
        <button className="btn btn--whatsapp btn--sm btn--auto" onClick={sendAccountant}><Icon name="whatsapp" />{t.sendAccountant}</button>
      </div>
      <p className="t-caption t-3">{t.notFiscal}</p>

      {/* visits */}
      {byDay.length === 0 ? <p className="t-small t-3">{t.noVisits}</p> : (
        <div className="stack stack--3">
          <p className="t-small t-2 no-print">{t.markHint}</p>
          {byDay.map((g) => (
            <div key={g.date} className="stack stack--2">
              <p className="label-caps">{DAYS_SHORT[weekdayOf(g.date) - 1]} {fmtDayMonth(g.date)}</p>
              <ul className="list">
                {g.rows.map((v) => (
                  <li key={v.id} className="row">
                    <span className="row__main"><span className="row__title">{v.time} · {v.customer}</span><span className="row__meta">{v.service} · {eur(v.priceCents)}</span></span>
                    <span className="paybtns">
                      <button className={`chip${v.paid === 'cash' ? ' is-selected' : ''}`} aria-pressed={v.paid === 'cash'} onClick={() => setMethod(v.id, v.paid === 'cash' ? '' : 'cash')}>{t.cash}</button>
                      <button className={`chip${v.paid === 'card' ? ' is-selected' : ''}`} aria-pressed={v.paid === 'card'} onClick={() => setMethod(v.id, v.paid === 'card' ? '' : 'card')}>{t.card}</button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* expenses */}
      <div className="stack stack--2">
        <div className="split"><p className="label-caps">{t.expenses}</p><button className="btn btn--secondary btn--sm btn--auto no-print" onClick={() => setAdding(true)}><Icon name="plus" size="sm" />{t.addExpense}</button></div>
        {m.expenses.length > 0 && (
          <ul className="list">
            {m.expenses.map((x) => (
              <li key={x.id} className="row">
                <span className="row__main"><span className="row__title">{t.expenseCats[x.category] || x.category} · {eur(x.amountCents)}</span><span className="row__meta">{fmtDayMonth(x.date)}{x.note ? ` · ${x.note}` : ''}</span></span>
                {x.hasReceipt && <a className="iconbtn no-print" href={`/api/expenses/${x.id}/receipt`} target="_blank" rel="noopener noreferrer" aria-label={t.receipt}><Icon name="image" size="sm" /></a>}
                <button className="iconbtn no-print" aria-label={t.deleteExpense} onClick={() => delExpense(x.id)}><Icon name="trash" size="sm" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} title={t.expenseTitle} closeButton
        actions={<button className={`btn btn--primary${busy ? ' is-loading' : ''}`} disabled={busy || !(Number(amount.replace(',', '.')) > 0)} onClick={saveExpense}>{t.saveExpense}</button>}>
        <div className="stack stack--4">
          <Field label={t.amount} htmlFor="ex-amount"><input id="ex-amount" className="input t-num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="25" /></Field>
          <Field label={t.category}>
            <div className="chips chips--wrap" role="group">
              {Object.entries(t.expenseCats).map(([k, v]) => <button key={k} type="button" className={`chip${cat === k ? ' is-selected' : ''}`} aria-pressed={cat === k} onClick={() => setCat(k)}>{v}</button>)}
            </div>
          </Field>
          <Field label={sq.calendar.day} htmlFor="ex-date"><input id="ex-date" className="input" type="date" value={date} min={`${d.month}-01`} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={t.note} htmlFor="ex-note"><input id="ex-note" className="input" value={note} maxLength={120} placeholder={t.notePh} onChange={(e) => setNote(e.target.value)} /></Field>
          <Field label={t.receipt} htmlFor="ex-file"><input id="ex-file" className="input" type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
        </div>
      </Sheet>
    </section>
  );
}
