import { loadSeatingPrint, type PrintData, type PrintGroup } from '@/lib/seating-print'
import { seatSlots, tableBody, footprint, SEAT_R } from '@/lib/floor-plan'
import PrintButton from './PrintButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Seating plan', robots: { index: false, follow: false } }

const TZ = 'Asia/Dubai'
const fmtDateTime = (iso: string | Date) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

type AtTable = { group: PrintGroup; count: number; part: string }

// Who sits at each table. A party spread over several tables is shown at each,
// and its people are counted against them in table order, fullest first.
function seatedByTable(data: PrintData): { byTable: Map<number, AtTable[]>; unseated: PrintGroup[] } {
  const byTable = new Map<number, AtTable[]>()
  const unseated: PrintGroup[] = []
  for (const g of data.groups) {
    if (g.tables.length === 0) { unseated.push(g); continue }
    let left = g.headcount
    g.tables.forEach((n, i) => {
      const here = i === g.tables.length - 1 ? left : Math.min(data.seatsPerTable, left)
      left -= here
      byTable.set(n, [...(byTable.get(n) || []), { group: g, count: here, part: g.tables.length > 1 ? ` (${i + 1} of ${g.tables.length})` : '' }])
    })
  }
  return { byTable, unseated }
}

export default async function SeatingPrintPage({
  params, searchParams,
}: { params: { id: string }; searchParams: { mode?: string } }) {
  const data = await loadSeatingPrint(params.id, searchParams.mode === 'draft' ? 'draft' : 'live')
  if ('error' in data) {
    return <div style={{ padding: 32, color: '#222', background: '#fff' }}><p>{data.error}</p></div>
  }
  const draft = data.mode === 'draft'
  const { byTable, unseated } = seatedByTable(data)
  const { layout, seatsPerTable } = data
  const emptyTables = Array.from({ length: data.tableCount }, (_, i) => i + 1).filter(n => (byTable.get(n) || []).length === 0)
  // Crop to what is actually in the room (tables, seats, names under them, labels), so a
  // small plan fills the sheet and the names print as large as they can.
  const view = (() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const t of layout.tables) {
      const f = footprint(t, seatsPerTable)
      x0 = Math.min(x0, t.x - Math.max(f.w / 2, 100)); x1 = Math.max(x1, t.x + Math.max(f.w / 2, 100))
      y0 = Math.min(y0, t.y - f.h / 2); y1 = Math.max(y1, t.y + f.h / 2 + 64)
    }
    for (const l of layout.labels) { x0 = Math.min(x0, l.x); y0 = Math.min(y0, l.y); x1 = Math.max(x1, l.x + l.w); y1 = Math.max(y1, l.y + l.h) }
    if (!Number.isFinite(x0)) return { x: 0, y: 0, w: layout.room.w, h: layout.room.h }
    const pad = 30
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad)
    x1 = Math.min(layout.room.w, x1 + pad); y1 = Math.min(layout.room.h, y1 + pad)
    return { x: x0, y: y0, w: Math.max(200, x1 - x0), h: Math.max(150, y1 - y0) }
  })()
  const printed = fmtDateTime(new Date())
  const status = draft
    ? 'DRAFT, seating not locked. This plan is not the live seating.'
    : data.locked && data.lockedAt ? `Seating locked ${fmtDateTime(data.lockedAt)}` : 'Seating is not locked yet, so this plan may change.'
  const seated = data.groups.reduce((s, g) => s + (g.tables.length ? g.headcount : 0), 0)
  const total = data.groups.reduce((s, g) => s + g.headcount, 0)

  return (
    <div className="seatprint">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="noprint toolbar">
        <PrintButton />
        <a href={`?mode=live`} className={!draft ? 'on' : ''}>Live seating</a>
        {data.draftAvailable && <a href={`?mode=draft`} className={draft ? 'on' : ''}>Draft</a>}
        <span className="tip">Choose paper size A3 and landscape. Turn off headers and footers, and switch on background graphics.</span>
        {!draft && !data.locked && <span className="warn">Seating is not locked yet, so this plan may change.</span>}
      </div>

      {draft && <div className="watermark" aria-hidden="true">DRAFT</div>}

      <table className="sheet">
        <thead>
          <tr><td>
            <div className="head">
              <div><div className="ttl">{data.title}</div>
                <div className="sub">{fmtDate(data.eventDate)}{data.venue ? `  ·  ${data.venue}` : ''}</div></div>
              <div className="kind">{draft ? 'DRAFT SEATING PLAN' : 'SEATING PLAN'}</div>
            </div>
          </td></tr>
        </thead>
        <tfoot>
          <tr><td>
            <div className="foot"><span>Printed {printed} (Dubai time)</span><span className={draft ? 'draftnote' : ''}>{status}</span></div>
          </td></tr>
        </tfoot>
        <tbody>
          <tr className="pagebreak"><td>
            <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet" className="room" role="img" aria-label="Room plan">
              {layout.labels.map(l => (
                <g key={l.id}>
                  <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={6} fill="#eee" stroke="#888" strokeWidth={2} />
                  <text x={l.x + l.w / 2} y={l.y + l.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(28, l.h * 0.5)} fontFamily="Helvetica, Arial, sans-serif" fontWeight={700} fill="#333">{short(l.text, 40)}</text>
                </g>
              ))}
              {layout.tables.map(t => {
                const body = tableBody(t.shape, seatsPerTable)
                const slots = seatSlots(t.shape, seatsPerTable)
                const f = footprint(t, seatsPerTable)
                const here = byTable.get(t.n) || []
                const used = here.reduce((s, h) => s + h.count, 0)
                const over = used > seatsPerTable
                // How many lines of names fit under this table before they would run into the
                // table below it (or the bottom of the room). Always at least one.
                let gap = layout.room.h - (t.y + f.h / 2)
                for (const u of layout.tables) {
                  if (u.n === t.n || u.y <= t.y) continue
                  const fu = footprint(u, seatsPerTable)
                  if (Math.abs(u.x - t.x) < (f.w + fu.w) / 2) gap = Math.min(gap, u.y - fu.h / 2 - (t.y + f.h / 2))
                }
                const lines = Math.min(3, Math.max(1, Math.floor((gap - 4) / 17)))
                const crowded = here.length > lines
                const shown = crowded ? here.slice(0, Math.max(0, lines - 1)) : here
                const hidden = here.length - shown.length
                return (
                  <g key={t.n}>
                    <g transform={`translate(${t.x} ${t.y}) rotate(${t.rot})`}>
                      {t.shape === 'round'
                        ? <circle r={body.w / 2} fill="#fff" stroke={over ? '#b00020' : '#222'} strokeWidth={over ? 4 : 2.5} />
                        : <rect x={-body.w / 2} y={-body.h / 2} width={body.w} height={body.h} rx={8} fill="#fff" stroke={over ? '#b00020' : '#222'} strokeWidth={over ? 4 : 2.5} />}
                      {slots.map((s, i) => <circle key={i} cx={s.dx} cy={s.dy} r={SEAT_R} fill={i < used ? '#333' : '#fff'} stroke="#222" strokeWidth={2} />)}
                    </g>
                    <text x={t.x} y={t.y} textAnchor="middle" dominantBaseline="central" fontSize={38} fontFamily="Helvetica, Arial, sans-serif" fontWeight={800} fill="#111">{t.n}</text>
                    {shown.map((h, i) => (
                      <text key={h.group.key + i} x={t.x} y={t.y + f.h / 2 + 18 + i * 17} textAnchor="middle" fontSize={15} fontFamily="Helvetica, Arial, sans-serif" fill="#111"
                        stroke="#fff" strokeWidth={5} paintOrder="stroke">
                        {short(h.group.lead, 22)} x{h.count}
                      </text>
                    ))}
                    {hidden > 0 && (
                      <text x={t.x} y={t.y + f.h / 2 + 18 + shown.length * 17} textAnchor="middle" fontSize={13} fontFamily="Helvetica, Arial, sans-serif" fill="#444" stroke="#fff" strokeWidth={4} paintOrder="stroke">
                        {shown.length === 0 ? `${here.length} group${here.length === 1 ? '' : 's'}, ${used} people` : `+${hidden} more`}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
            <div className="legend">{seated} of {total} people seated at {data.tableCount} tables of {seatsPerTable}. Filled seats are taken. A red table has more people than seats.</div>
          </td></tr>

          <tr><td>
            <h2>Who is at each table</h2>
            <div className="cols">
              {Array.from({ length: data.tableCount }, (_, i) => i + 1).filter(n => (byTable.get(n) || []).length > 0).map(n => {
                const here = byTable.get(n) || []
                const used = here.reduce((s, h) => s + h.count, 0)
                return (
                  <section key={n} className="tbl">
                    <h3>Table {n} <span className={used > seatsPerTable ? 'over' : 'cnt'}>{used} of {seatsPerTable}{used > seatsPerTable ? ' OVER' : ''}</span></h3>
                    {here.map(h => (
                      <div key={h.group.key} className="grp">
                        {h.group.tables[0] === n || h.group.tables.length < 2 ? (
                          <>
                            {h.group.names.map((nm, i) => <div key={i}>{nm}</div>)}
                            {h.group.unnamed > 0 && <div className="mute">+{h.group.unnamed} guest{h.group.unnamed === 1 ? '' : 's'} (names not given)</div>}
                            {h.part && <div className="mute">Party of {h.group.headcount} is split across tables {h.group.tables.join(', ')}. {h.count} seated here. All names are listed here.</div>}
                          </>
                        ) : (
                          <div className="mute">{h.group.lead}&rsquo;s party of {h.group.headcount} is split across tables {h.group.tables.join(', ')}. {h.count} seated here{h.part}. All names are listed at Table {h.group.tables[0]}.</div>
                        )}
                      </div>
                    ))}
                  </section>
                )
              })}
            </div>
            {emptyTables.length > 0 && <p className="emptynote">Empty tables: {emptyTables.join(', ')}</p>}
            {unseated.length > 0 && (
              <section className="tbl notseated">
                <h3>Not yet seated <span className="cnt">{unseated.reduce((s, g) => s + g.headcount, 0)} people</span></h3>
                <div className="cols">
                  {unseated.map(g => (
                    <div key={g.key} className="grp">
                      {g.names.map((nm, i) => <div key={i}>{nm}</div>)}
                      {g.unnamed > 0 && <div className="mute">+{g.unnamed} guest{g.unnamed === 1 ? '' : 's'} (names not given)</div>}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </td></tr>
        </tbody>
      </table>
    </div>
  )
}

const CSS = `
.seatprint{position:relative;z-index:50;background:#fff;color:#111;font-family:Helvetica,Arial,sans-serif;min-height:100vh;padding:16px 24px 40px}
.seatprint .toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:0 auto 16px;max-width:1100px}
.seatprint .toolbar a{color:#555;text-decoration:none;border:1px solid #bbb;border-radius:8px;padding:8px 14px;font-size:14px}
.seatprint .toolbar a.on{background:#222;color:#fff;border-color:#222}
.seatprint .tip{color:#666;font-size:13px}
.seatprint .warn{color:#8a5a00;background:#fff3d6;border:1px solid #e0b657;border-radius:8px;padding:6px 10px;font-size:13px;font-weight:600}
.seatprint .sheet{width:100%;max-width:1587px;margin:0 auto;border-collapse:collapse}
.seatprint .sheet td{padding:0}
.seatprint .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #111;padding-bottom:6px;margin-bottom:8px}
.seatprint .ttl{font-size:26px;font-weight:800}
.seatprint .sub{font-size:14px;color:#333;margin-top:2px}
.seatprint .kind{font-size:14px;font-weight:800;letter-spacing:.12em}
.seatprint .foot{display:flex;justify-content:space-between;border-top:1px solid #999;padding-top:4px;margin-top:8px;font-size:11px;color:#333}
.seatprint .draftnote{font-weight:800;color:#b00020}
.seatprint .room{display:block;width:100%;height:auto}
.seatprint .legend{font-size:11px;color:#444;margin-top:4px}
.seatprint h2,.seatprint h3{font-family:Helvetica,Arial,sans-serif}
.seatprint h2{font-size:20px;margin:6px 0 8px}
.seatprint .cols{columns:4;column-gap:20px}
.seatprint .tbl{break-inside:avoid;margin:0 0 10px;border:1px solid #888;border-radius:6px;padding:6px 8px}
.seatprint .tbl h3{font-size:15px;margin:0 0 4px;display:flex;justify-content:space-between;gap:8px}
.seatprint .cnt{font-weight:400;font-size:12px;color:#555}
.seatprint .over{font-weight:800;font-size:12px;color:#b00020}
.seatprint .grp{font-size:12.5px;line-height:1.35;padding:3px 0;border-top:1px dashed #bbb;break-inside:avoid}
.seatprint .grp:first-of-type{border-top:0}
.seatprint .mute,.seatprint .none{color:#666;font-size:11px;font-style:italic}
.seatprint .emptynote{font-size:12.5px;color:#444;margin:4px 0 0}
.seatprint .notseated{margin-top:12px;border-style:dashed}
.seatprint .notseated .cols{columns:4}
.seatprint .watermark{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-size:260px;font-weight:900;color:rgba(176,0,32,.10);transform:rotate(-24deg);pointer-events:none;z-index:60;letter-spacing:.05em}
@page{size:A3 landscape;margin:12mm}
@media print{
  body > :not(main){display:none !important}
  html,body{background:#fff !important}
  main{padding:0 !important}
  .noprint{display:none !important}
  .animate-page-in{animation:none !important;opacity:1 !important;transform:none !important}
  .seatprint{padding:0;min-height:0}
  .seatprint .sheet{max-width:none}
  .seatprint .pagebreak{break-after:page}
  .seatprint .room{height:222mm}
  thead{display:table-header-group} tfoot{display:table-footer-group}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
`
