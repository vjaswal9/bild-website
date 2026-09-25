"""Part 2: the favicon tile and the social templates.

Same rule as part 1 - one crown, taken from the website. The layouts here are
the ones the previous pack established (onyx tile with a gold keyline for the
icon; centred lockup with a warm corner glow and the strapline for social).
Only the crown geometry and the gold have changed.
"""
import os
from _rebuild import crown, FONT, GOLD, IVORY, ONYX

STRAP = 'BELONG  ·  CONNECT  ·  GROW'


def icon_tile(px=512, border=True):
    """Rounded onyx tile, gold keyline, crown over a single B."""
    k = px / 512.0
    bw = max(1.0, 8 * k)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="{px}" height="{px}">
  <rect x="{bw/2}" y="{bw/2}" width="{512-bw}" height="{512-bw}" rx="{96}"
    fill="{ONYX}"{f' stroke="{GOLD}" stroke-width="{bw}"' if border else ''}/>
{crown(GOLD, 3.1, 256.0, 120.0)}
  <text x="256" y="400" text-anchor="middle" font-family="{FONT}"
    font-weight="700" font-size="260" fill="{IVORY}">B</text>
</svg>
'''


def social(w, h, scale=1.0, strapline=True):
    """Centred lockup on onyx with a warm glow in the top-right corner."""
    cx = w / 2.0
    s = min(w / 1200.0, h / 630.0) * scale
    top = h / 2.0 - 122 * s
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">
  <defs>
    <radialGradient id="glow" cx="78%" cy="22%" r="62%">
      <stop offset="0%" stop-color="{GOLD}" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="{GOLD}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="{w}" height="{h}" fill="{ONYX}"/>
  <rect width="{w}" height="{h}" fill="url(#glow)"/>
{crown(GOLD, 2.0 * s, cx, top)}
  <text x="{cx}" y="{top + 150 * s}" text-anchor="middle" font-family="{FONT}"
    font-size="{116 * s:.1f}" font-weight="700" letter-spacing="{12 * s:.1f}" fill="{IVORY}">B.I.L.D</text>
  <line x1="{cx - 200 * s:.1f}" y1="{top + 195 * s:.1f}" x2="{cx - 136 * s:.1f}" y2="{top + 195 * s:.1f}"
    stroke="{GOLD}" stroke-width="{2 * s:.1f}"/>
  <text x="{cx}" y="{top + 202 * s:.1f}" text-anchor="middle" font-family="{FONT}"
    font-size="{26 * s:.1f}" letter-spacing="{9 * s:.1f}" fill="{GOLD}">ESTD  2019</text>
  <line x1="{cx + 136 * s:.1f}" y1="{top + 195 * s:.1f}" x2="{cx + 200 * s:.1f}" y2="{top + 195 * s:.1f}"
    stroke="{GOLD}" stroke-width="{2 * s:.1f}"/>
''' + (f'''  <text x="{cx}" y="{top + 253 * s:.1f}" text-anchor="middle"
    font-family="Helvetica, Arial, sans-serif" font-size="{23 * s:.1f}"
    letter-spacing="{7.5 * s:.1f}" fill="#B9B4AA">{STRAP}</text>
''' if strapline else '') + '</svg>\n'


os.makedirs('_svg-build', exist_ok=True)
w = lambda p, s: open(p, 'w').write(s)
w('_svg-build/icon-tile.svg', icon_tile())
w('_svg-build/icon-tile-plain.svg', icon_tile(border=False))
w('_svg-build/open-graph.svg', social(1200, 630))
w('_svg-build/facebook-cover.svg', social(1640, 624, 0.92))
w('_svg-build/linkedin-banner.svg', social(1584, 396, 0.62))
w('_svg-build/x-header.svg', social(1500, 500, 0.78))
w('_svg-build/avatar.svg', icon_tile(1080, border=False))
# The social avatar master. Generated here rather than by hand: it was left
# behind on an earlier pass and kept the old crown after the rest had moved.
w('04-social/_avatar.svg', icon_tile(600, border=False))
print('social + icon templates written:', sorted(os.listdir('_svg-build')))
