'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Side = { n: number; title: string; text: string }
type Next = { set: { id: string; name: string; theme?: string }; done: number; total: number; teamTotal?: number; pair: null | { k: number; left: Side; right: Side }; error?: string }

const remember = (k: string, v?: string) => { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v) } catch {} return '' }

export default function Judge({ setId }: { setId: string }) {
  const [name, setName] = useState('')
  const [draftName, setDraftName] = useState('')
  const [next, setNext] = useState<Next | null>(null)
  const [ideas, setIdeas] = useState<number | null>(null)
  const [writing, setWriting] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const shownAt = useRef(Date.now())

  useEffect(() => { const n = remember('cj-judge') as string; if (n) setName(n) }, [])

  const load = useCallback(async (who: string) => {
    setErr(''); setBusy(true)
    try {
      const r = await fetch(`/api/cj/human?judge=${encodeURIComponent(who)}${setId ? `&set=${encodeURIComponent(setId)}` : ''}`, { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Could not load the next pair')
      setNext(j); setIdeas(null); setWriting(null); setNote(''); shownAt.current = Date.now()
      window.scrollTo({ top: 0 })
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }, [setId])

  useEffect(() => { if (name) load(name) }, [name, load])

  async function submit() {
    if (!next?.pair || ideas == null || writing == null) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/cj/human', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ set: next.set.id, judge: name, pair: next.pair.k, left_n: next.pair.left.n, right_n: next.pair.right.n, ideas_winner: ideas, writing_winner: writing, ideas_reason: note || null, seconds: (Date.now() - shownAt.current) / 1000 }),
      })
      if (!r.ok) throw new Error((await r.json()).error || 'Not saved')
      await load(name)
    } catch (e: any) { setErr(e.message); setBusy(false) }
  }

  if (!name) return (
    <div className="wrap"><style>{CSS}</style>
      <h1>Ideas &amp; voice: judging</h1>
      <p className="lede">You will see two pieces on the same subject, with the house names removed, and pick the better one on two questions. Go with your editorial instinct: 30 to 60 seconds a pair is right. Your choices anchor the scale Claude builds from its own judgements.</p>
      <form className="namebox" onSubmit={e => { e.preventDefault(); const n = draftName.trim(); if (n) { remember('cj-judge', n); setName(n) } }}>
        <label htmlFor="who">Your name</label>
        <input id="who" value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="e.g. James" autoFocus />
        <button type="submit">Start judging</button>
      </form>
    </div>
  )

  const p = next?.pair
  return (
    <div className="wrap"><style>{CSS}</style>
      <header>
        <div>
          <h1>{next?.set.name || 'Ideas & voice: judging'}</h1>
          <p className="stats">{name} · {next?.done ?? 0} judged by you{next?.teamTotal != null ? ` · ${next.teamTotal} by the team` : ''} · aim for about 60 each · <a href="/judge/results">results</a> · <a href="#" onClick={e => { e.preventDefault(); remember('cj-judge', ''); setName(''); setNext(null) }}>not {name}?</a></p>
        </div>
      </header>
      {err && <p className="err">{err}</p>}
      {next && !p && <p className="lede">You have judged every pair in this set. Thank you.</p>}
      {p && (
        <>
          <p className="hint">Both pieces are cut to the same length, so ignore how much ground each covers. Judge the thinking and the writing separately: a piece can win one and lose the other.</p>
          <div className="pair">
            {[p.left, p.right].map((s, i) => (
              <article key={s.n} className={`piece ${ideas === s.n ? 'ideas' : ''} ${writing === s.n ? 'writing' : ''}`}>
                <div className="label">{i === 0 ? 'Left' : 'Right'}</div>
                <h2>{s.title}</h2>
                <div className="text">{s.text.split(/\n{2,}/).map((para, k) => <p key={k}>{para}</p>)}</div>
              </article>
            ))}
          </div>
          <div className="bar">
            <Choice label="Ideas: which has the more original, valuable thinking?" value={ideas} set={setIdeas} left={p.left.n} right={p.right.n} />
            <Choice label="Writing: which is better written?" value={writing} set={setWriting} left={p.left.n} right={p.right.n} />
            <input className="note" value={note} onChange={e => setNote(e.target.value)} placeholder="Why, in a few words (optional)" />
            <button className="go" disabled={busy || ideas == null || writing == null} onClick={submit}>{busy ? 'Saving…' : 'Save and next'}</button>
          </div>
        </>
      )}
    </div>
  )
}

function Choice({ label, value, set, left, right }: { label: string; value: number | null; set: (n: number) => void; left: number; right: number }) {
  return (
    <div className="choice" role="group" aria-label={label}>
      <span>{label}</span>
      <div>
        <button className={value === left ? 'on' : ''} onClick={() => set(left)}>Left</button>
        <button className={value === right ? 'on' : ''} onClick={() => set(right)}>Right</button>
      </div>
    </div>
  )
}

const CSS = `
:root { --bg:#f6f5f1; --card:#fff; --ink:#1b1d21; --muted:#6b6f76; --line:#e3e1db; --accent:#1f4e79; --chip:#eef2f6; --ideas:#b45309; --writing:#1f4e79; }
@media (prefers-color-scheme: dark) { :root { --bg:#141518; --card:#1c1e22; --ink:#ececec; --muted:#9a9ea6; --line:#2c2f35; --accent:#8db8e6; --chip:#252a31; --ideas:#f0a35e; --writing:#8db8e6; } }
body { background: var(--bg) !important; color: var(--ink) !important; }
.wrap { max-width: 1320px; margin: 0 auto; padding: 24px 16px 140px; }
h1 { font-size: 22px; margin: 0; letter-spacing: -0.01em; }
.stats { color: var(--muted); font-size: 13px; margin: 6px 0 0; }
.stats a { color: var(--accent); }
.lede { max-width: 640px; line-height: 1.55; }
.hint { color: var(--muted); font-size: 13px; margin: 14px 0; }
.err { color: #b91c1c; }
.namebox { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top: 16px; }
.namebox input, .note { font: inherit; padding: 8px 10px; border:1px solid var(--line); border-radius:6px; background: var(--card); color: var(--ink); }
button { font: inherit; font-size: 14px; padding: 8px 14px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--ink); cursor: pointer; }
.namebox button, .go { background: var(--accent); border-color: var(--accent); color: #fff; }
.go:disabled { opacity: .45; cursor: default; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 800px) { .pair { grid-template-columns: 1fr; } }
.piece { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; max-height: 68vh; overflow-y: auto; position: relative; }
.piece.ideas { box-shadow: inset 4px 0 0 var(--ideas); }
.piece.writing { outline: 2px solid var(--writing); }
.label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
.piece h2 { font-size: 17px; line-height: 1.35; margin: 6px 0 12px; }
.text p { font-size: 15px; line-height: 1.6; margin: 0 0 12px; max-width: 70ch; }
.bar { position: fixed; left: 0; right: 0; bottom: 0; background: var(--card); border-top: 1px solid var(--line); padding: 10px 16px; display: flex; gap: 14px; align-items: center; flex-wrap: wrap; justify-content: center; }
.choice { display:flex; gap:8px; align-items:center; font-size: 13px; }
.choice div { display:flex; gap:4px; }
.choice button.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.note { min-width: 220px; flex: 0 1 280px; font-size: 13px; }
`
