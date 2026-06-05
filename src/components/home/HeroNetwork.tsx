// Faded network/connection pattern for the hero background
// Represents community connections — nodes linked by lines, echoing the BILD spirit

const NODES = [
  { x: 8,  y: 12 }, { x: 22, y: 5  }, { x: 38, y: 18 }, { x: 55, y: 8  }, { x: 70, y: 22 },
  { x: 85, y: 6  }, { x: 95, y: 18 }, { x: 15, y: 32 }, { x: 32, y: 40 }, { x: 48, y: 30 },
  { x: 62, y: 42 }, { x: 78, y: 35 }, { x: 92, y: 45 }, { x: 5,  y: 55 }, { x: 20, y: 62 },
  { x: 35, y: 58 }, { x: 50, y: 68 }, { x: 65, y: 55 }, { x: 80, y: 65 }, { x: 97, y: 58 },
  { x: 12, y: 78 }, { x: 28, y: 85 }, { x: 44, y: 78 }, { x: 60, y: 88 }, { x: 75, y: 78 },
  { x: 90, y: 85 }, { x: 3,  y: 92 }, { x: 18, y: 96 }, { x: 42, y: 94 }, { x: 58, y: 96 },
  { x: 72, y: 94 }, { x: 88, y: 96 }, { x: 25, y: 22 }, { x: 45, y: 52 }, { x: 68, y: 12 },
  { x: 82, y: 50 }, { x: 10, y: 45 }, { x: 56, y: 35 }, { x: 30, y: 70 }, { x: 88, y: 28 },
]

// Connect nodes that are within ~22 units of each other
function getEdges() {
  const edges: [number, number][] = []
  for (let i = 0; i < NODES.length; i++) {
    for (let j = i + 1; j < NODES.length; j++) {
      const dx = NODES[i].x - NODES[j].x
      const dy = NODES[i].y - NODES[j].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 22) edges.push([i, j])
    }
  }
  return edges
}

const EDGES = getEdges()

// A handful of nodes get a brighter glow
const BRIGHT = new Set([2, 8, 16, 24, 33, 37])

export default function HeroNetwork() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Connection lines */}
        {EDGES.map(([a, b], i) => (
          <line
            key={i}
            x1={NODES[a].x} y1={NODES[a].y}
            x2={NODES[b].x} y2={NODES[b].y}
            stroke="#C9A84C"
            strokeWidth="0.18"
            opacity="0.2"
          />
        ))}

        {/* Nodes — tiny dots only, no glow circles */}
        {NODES.map((n, i) => (
          <circle
            key={i}
            cx={n.x} cy={n.y}
            r={BRIGHT.has(i) ? 0.6 : 0.35}
            fill="#C9A84C"
            opacity={BRIGHT.has(i) ? 0.6 : 0.35}
          />
        ))}
      </svg>
    </div>
  )
}
