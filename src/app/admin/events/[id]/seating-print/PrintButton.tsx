'use client'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{ background: '#b8892b', color: '#fff', border: 0, borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
    >
      Print or save as PDF
    </button>
  )
}
