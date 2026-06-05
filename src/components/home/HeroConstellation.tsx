// Faded constellation / network background for the hero.
// Solid dots + straight connecting lines (NO concentric rings) so it reads
// as a community network, not a target. Brand gold with sparse warm accents.

type Node = { x: number; y: number; r: number; color: string; glow?: boolean }

// Hand-placed organic scatter across a 100x56 viewBox (16:9-ish)
const NODES: Node[] = [
  { x: 6,  y: 8,  r: 0.5, color: '#C9A84C' },
  { x: 18, y: 14, r: 0.8, color: '#E0A135', glow: true },
  { x: 30, y: 6,  r: 0.45, color: '#C9A84C' },
  { x: 42, y: 16, r: 0.6, color: '#C9A84C' },
  { x: 54, y: 9,  r: 0.9, color: '#7FB7C4', glow: true },
  { x: 66, y: 18, r: 0.5, color: '#C9A84C' },
  { x: 78, y: 7,  r: 0.7, color: '#E0A135', glow: true },
  { x: 90, y: 15, r: 0.5, color: '#C9A84C' },
  { x: 96, y: 5,  r: 0.45, color: '#C9A84C' },

  { x: 10, y: 26, r: 0.6, color: '#C9A84C' },
  { x: 24, y: 30, r: 0.5, color: '#C9A84C' },
  { x: 37, y: 24, r: 0.85, color: '#B8607A', glow: true },
  { x: 50, y: 32, r: 0.5, color: '#C9A84C' },
  { x: 62, y: 26, r: 0.6, color: '#C9A84C' },
  { x: 74, y: 30, r: 0.9, color: '#E0A135', glow: true },
  { x: 86, y: 24, r: 0.5, color: '#C9A84C' },
  { x: 95, y: 32, r: 0.55, color: '#7FB7C4', glow: true },

  { x: 4,  y: 44, r: 0.5, color: '#C9A84C' },
  { x: 16, y: 48, r: 0.8, color: '#C9A84C', glow: true },
  { x: 29, y: 42, r: 0.5, color: '#C9A84C' },
  { x: 44, y: 50, r: 0.6, color: '#E0A135' },
  { x: 57, y: 44, r: 0.5, color: '#C9A84C' },
  { x: 69, y: 50, r: 0.85, color: '#B8607A', glow: true },
  { x: 82, y: 44, r: 0.5, color: '#C9A84C' },
  { x: 92, y: 50, r: 0.6, color: '#C9A84C' },

  { x: 22, y: 38, r: 0.45, color: '#C9A84C' },
  { x: 48, y: 38, r: 0.5, color: '#7FB7C4' },
  { x: 60, y: 36, r: 0.45, color: '#C9A84C' },
  { x: 35, y: 54, r: 0.5, color: '#C9A84C' },
  { x: 76, y: 40, r: 0.45, color: '#C9A84C' },
  { x: 12, y: 36, r: 0.45, color: '#E0A135' },
]

// Connect nodes within a distance threshold
function buildEdges() {
  const edges: { a: number; b: number; o: number }[] = []
  for (let i = 0; i < NODES.length; i++) {
    for (let j = i + 1; j < NODES.length; j++) {
      const dx = NODES[i].x - NODES[j].x
      const dy = NODES[i].y - NODES[j].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 18) {
        // closer lines are slightly more visible
        edges.push({ a: i, b: j, o: Math.max(0.05, 0.22 - dist / 120) })
      }
    }
  }
  return edges
}

const EDGES = buildEdges()

export default function HeroConstellation() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 56"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="soft-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines */}
        <g opacity="0.55">
          {EDGES.map((e, i) => (
            <line
              key={i}
              x1={NODES[e.a].x} y1={NODES[e.a].y}
              x2={NODES[e.b].x} y2={NODES[e.b].y}
              stroke="#C9A84C"
              strokeWidth="0.12"
              opacity={e.o}
            />
          ))}
        </g>

        {/* Nodes — solid dots, some with a soft glow */}
        {NODES.map((n, i) => (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={n.color}
            opacity={n.glow ? 0.55 : 0.32}
            filter={n.glow ? 'url(#soft-glow)' : undefined}
          />
        ))}
      </svg>
    </div>
  )
}
