"""Regenerates every vector master in the BILD brand pack from ONE crown.

The pack previously carried a crown that did not match the website's: a single
continuous zigzag polygon, where the site uses three separate spikes on a
detached base. Colours had been reconciled in September 2026 but the geometry
never was, so the pack and the product drew a different mark.

The website is the master, per the same precedent that settled Premium Gold.
Every path below is lifted from public/bild-logo-new.svg.
"""
import os

GOLD, IVORY, ONYX, CHARCOAL = '#C8861A', '#F4F1EC', '#0E0E0E', '#2E2E2E'
# Georgia, not Playfair Display: it is what the website's logo actually sets,
# and being a system face it rasterises without a webfont fetch.
FONT = "Georgia, 'Times New Roman', serif"

# The original crown is 1.80:1 where the primitive one it replaces was 0.89:1.
# Dropped in at the same width it reads squat, so it is stretched vertically to
# sit somewhere between the two. 1.0 is the original's exact proportions.
SPIKE_LIFT = 1.45


def crown(fill, s=1.0, tx=160.0, ty=38.0):
    """The crown, in the original logo's own geometry.

    This used to draw the website's crown - three separate straight-sided
    spikes on a detached base, built from SVG primitives. The original mark is
    a single filled path: tapered spikes with concave flanks, ball finials and
    a base that bows gently upward. The crown in Bild_Logo_Old.pdf is real
    vector (unlike the mandala), so CROWN_ORIGINAL below is the designer's own
    path, not a redrawing.

    The signature is unchanged so every call site keeps working: the crown is
    44*s wide, centred on tx, with its base on ty + 26*s - exactly where the
    old base bar sat. It is shorter than the old one, because the original is
    1.80:1 where the primitive version was 0.89:1, so SPIKE_LIFT scales the
    height back up to keep the crown's presence without widening it.
    """
    w = 44.0 * s
    bottom = ty + 26.0 * s
    k = w / CROWN_ORIGINAL_W
    h = CROWN_ORIGINAL_H * k * SPIKE_LIFT
    return (f'  <g transform="translate({tx - w/2:.2f},{bottom - h:.2f}) '
            f'scale({k:.5f},{k*SPIKE_LIFT:.5f})" fill="{fill}">\n'
            f'    <path d="{CROWN_ORIGINAL}"/>\n  </g>')


def mandala(stroke=GOLD, opacity='0.26', R=96.0, cx=160.0, cy=100.0):
    """The mandala from the original BILD logo - the artwork itself.

    Three attempts at redrawing this in SVG primitives all came out wrong: the
    petals are subtler than they look and the dot gradation is hard to hit by
    eye. The real thing turned out to be a raster anyway - a 1442x1436 gold-foil
    image inside Bild_Logo_Old.pdf, never vector - so there is no vector master
    to be faithful to, and a redrawing could only ever be an approximation.

    So this embeds the genuine artwork. Its alpha channel is the designer's own
    curves, untouched; only the colour was flattened from the foil texture to
    Premium Gold, which both matches the rest of the pack and takes the file
    from 1.6 MB to 86 KB. `stroke` is accepted for signature compatibility and
    deliberately ignored - the artwork carries its own colour.

    Masters:
      01-logos/png/bild-mandala-original@1442.png  untouched, foil texture
      01-logos/png/bild-mandala-gold@600.png       flattened to Premium Gold
    """
    import base64, os
    src = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       '01-logos', 'png', 'bild-mandala-gold@600.png')
    b64 = base64.b64encode(open(src, 'rb').read()).decode()
    d = R * 2
    return (f'  <image x="{cx-R:.1f}" y="{cy-R:.1f}" width="{d:.1f}" height="{d:.1f}" '
            f'opacity="{opacity}" preserveAspectRatio="xMidYMid meet" '
            f'xlink:href="data:image/png;base64,{b64}" '
            f'href="data:image/png;base64,{b64}"/>')


def wordmark(text_fill, accent):
    """B.I.L.D plus the ESTD 2019 rule, at the website's exact coordinates."""
    return f'''  <text x="160" y="128" text-anchor="middle" font-family="{FONT}"
    font-size="58" font-weight="700" letter-spacing="6" fill="{text_fill}">B.I.L.D</text>
  <line x1="42" y1="153" x2="95" y2="153" stroke="{accent}" stroke-width="1.2"/>
  <text x="160" y="158" text-anchor="middle" font-family="{FONT}"
    font-size="13" letter-spacing="5" fill="{accent}">ESTD  2019</text>
  <line x1="225" y1="153" x2="278" y2="153" stroke="{accent}" stroke-width="1.2"/>'''


# The crown from the original logo, lifted straight out of the artwork.
#
# This is not the website's crown. The site draws three separate straight-sided
# spikes; the original is a single filled path - tapered spikes with concave
# flanks, ball finials, and a base that bows gently upward. It was recovered
# from the vector path in documents/Bild_Logo_Old.pdf (the crown there is real
# vector, unlike the mandala) and normalised to a 1000-wide box, 555.7 tall,
# origin top-left, Y already downward.
#
# Used by the motif lockups only. The plain logo variants still carry the
# website's crown, which remains the master for everything the site renders.
CROWN_ORIGINAL = (
    "M1000,93.97 C1000.44,112.67 985.42,127.96 966.82,127.96 C964.37,127.96 962,127.71 959.73,127.18 C922.57,260.71 885.41,422.2 848.25,555.74 C619.26,500.78 380.49,500.78 151.5,555.74 C114.34,422.24 77.18,260.75 40.02,127.25 C37.82,127.71 35.52,127.96 33.18,127.96 C14.58,127.96 -0.44,112.67 0,93.97 C0.41,76.36 14.78,62 32.38,61.59 C51.08,61.15 66.37,76.17 66.37,94.77 C66.37,107.46 59.24,118.49 48.78,124.09 C79.1,166.25 108.03,209.09 135.48,252.42 C168.27,303.12 231.39,332.55 295.85,327.3 C300.39,326.91 304.93,326.38 309.47,325.67 C373.19,315.64 425.87,272.41 443.64,215.72 C458.85,165.47 475.73,115.44 494.2,65.69 C479.14,62.67 467.8,49.5 467.58,33.65 C467.33,15.54 481.88,0.42 499.98,0 C518.67,-0.43 533.95,14.59 533.95,33.18 C533.95,49.1 522.78,62.36 507.82,65.59 C525.97,114.91 542.53,164.48 557.5,214.23 C575.93,273.26 631.96,317.41 698.65,325.53 C700.99,325.81 703.33,326.06 705.68,326.24 C770.31,331.49 833.61,301.84 866.27,250.96 C893.17,208.09 921.47,165.79 951.18,124.06 C940.72,118.46 933.63,107.43 933.63,94.77 C933.63,76.17 948.92,61.15 967.62,61.59 C985.23,62.01 999.59,76.36 1000,93.97 Z"
)
CROWN_ORIGINAL_W = 1000.0
CROWN_ORIGINAL_H = 555.7


def crown_original(fill, width, cx, bottom):
    """Places the original crown centred on cx with its base sitting on `bottom`."""
    k = width / CROWN_ORIGINAL_W
    return (f'  <g transform="translate({cx - width/2:.2f},{bottom - CROWN_ORIGINAL_H*k:.2f}) '
            f'scale({k:.5f})" fill="{fill}">\n'
            f'    <path d="{CROWN_ORIGINAL}"/>\n  </g>')


def motif_lockup(crown_fill, text_fill, C=800.0, opacity='0.45'):
    """The original logo's composition: the wordmark contained by the mandala.

    The landscape lockup put a wide B.I.L.D across a mandala that was narrower
    than the text, so the wordmark ran out past the pattern on both sides. The
    original does the opposite - the mandala is the frame and everything sits
    inside it.

    Every ratio below was read off the original artwork's own content stream in
    documents/Bild_Logo_Old.pdf, as a fraction of its square canvas:

        mandala diameter   0.630        B.I.L.D size      0.1420
        B.I.L.D width      0.804 x D    B.I.L.D baseline  0.5452
        ESTD size          0.0111       ESTD baseline     0.5703
        crown width        0.0750       crown bottom      0.4418

    textLength pins the wordmark to that 0.804 of the mandala's diameter, so
    the containment holds whatever the rendering font turns out to be, rather
    than depending on Georgia's metrics being available.
    """
    D  = 0.630 * C                       # mandala diameter
    cx = cy = C / 2.0
    # The original's crown sat with its base at 0.4418, almost touching the
    # cap line. Raised to 0.4180 so it reads as a separate element above the
    # wordmark rather than resting on it.
    crown_w, crown_bottom = 0.0750 * C, 0.4180 * C
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"'
        f' viewBox="0 0 {C:.0f} {C:.0f}" width="{C:.0f}" height="{C:.0f}">\n'
        + mandala(GOLD, opacity, R=D / 2.0, cx=cx, cy=cy) + '\n'
        + crown_original(crown_fill, crown_w, cx, crown_bottom) + '\n'
        + f'  <text x="{cx:.1f}" y="{0.5452*C:.1f}" text-anchor="middle" font-family="{FONT}"\n'
          f'    font-size="{0.1420*C:.1f}" font-weight="700" textLength="{0.804*D:.1f}"\n'
          f'    lengthAdjust="spacing" fill="{text_fill}">B.I.L.D</text>\n'
        + f'  <text x="{cx:.1f}" y="{0.5703*C:.1f}" text-anchor="middle" font-family="{FONT}"\n'
          f'    font-size="{0.0111*C:.2f}" letter-spacing="{0.0042*C:.2f}" fill="{text_fill}">ESTD  2019</text>\n'
        # Rules either side of ESTD 2019, as on the plain lockups. Set on the
        # text's optical middle rather than its baseline, and kept clear of the
        # widest the letter-spaced date can run.
        + f'  <line x1="{cx-0.112*C:.1f}" y1="{0.5664*C:.1f}" x2="{cx-0.060*C:.1f}" y2="{0.5664*C:.1f}"\n'
          f'    stroke="{text_fill}" stroke-width="{0.0013*C:.2f}"/>\n'
        + f'  <line x1="{cx+0.060*C:.1f}" y1="{0.5664*C:.1f}" x2="{cx+0.112*C:.1f}" y2="{0.5664*C:.1f}"\n'
          f'    stroke="{text_fill}" stroke-width="{0.0013*C:.2f}"/>\n'
        + '</svg>\n')


def logo(crown_fill, text_fill, accent, motif=None):
    ns = ' xmlns:xlink="http://www.w3.org/1999/xlink"' if motif else ''
    body = [f'<svg xmlns="http://www.w3.org/2000/svg"{ns} viewBox="0 0 320 200" width="320" height="200">']
    if motif:
        body.append(mandala(motif))
    body.append(crown(crown_fill))
    body.append(wordmark(text_fill, accent))
    body.append('</svg>')
    return '\n'.join(body) + '\n'


os.makedirs('01-logos/svg', exist_ok=True)
os.makedirs('02-mark-monogram/svg', exist_ok=True)

# Gold crown + ivory text, for dark grounds.
w = lambda p, s: open(p, 'w').write(s)
w('01-logos/svg/bild-logo-primary.svg',  logo(GOLD,  IVORY,    GOLD))
# Gold crown + charcoal text: byte-for-byte the mark the website renders.
w('01-logos/svg/bild-logo-reversed.svg', logo(GOLD,  CHARCOAL, GOLD))
w('01-logos/svg/bild-logo-gold.svg',     logo(GOLD,  GOLD,     GOLD))
w('01-logos/svg/bild-logo-white.svg',    logo(IVORY, IVORY,    IVORY))
w('01-logos/svg/bild-logo-black.svg',    logo(ONYX,  ONYX,     ONYX))
# The motif lockups are deliberately mono. A gold crown over a gold mandala
# reads as one texture; black on light and ivory on dark keep the lockup in
# front of the pattern instead of dissolving into it.
# Square, and contained: the mandala frames the wordmark rather than sitting
# behind a wordmark wider than itself. See motif_lockup for the ratios.
w('01-logos/svg/bild-logo-motif.svg',       motif_lockup(IVORY, IVORY))
w('01-logos/svg/bild-logo-motif-light.svg', motif_lockup(ONYX,  ONYX))

# Crown mark alone, centred in 240x200. At s=3 the crown is 132 x 148.5.
S = 3.0
TY = (200 - 49.5 * S) / 2 + 23.5 * S
for name, fill in (('gold', GOLD), ('ivory', IVORY), ('onyx', ONYX)):
    w(f'02-mark-monogram/svg/bild-mark-crown-{name}.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="240" height="200">\n'
      + crown(fill, S, 120.0, TY) + '\n</svg>\n')

# "B" monogram: small crown above a single letter.
def monogram(text_fill, ground=None):
    s = 1.35
    g = (f'  <rect width="240" height="240" rx="24" fill="{ground}"/>\n' if ground else '')
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">\n'
            + g + crown(GOLD, s, 120.0, 55.0) + '\n'
            + f'  <text x="120" y="192" text-anchor="middle" font-family="{FONT}"\n'
              f'    font-weight="700" font-size="124" fill="{text_fill}">B</text>\n</svg>\n')

w('02-mark-monogram/svg/bild-monogram-B.svg', monogram(IVORY))
w('02-mark-monogram/svg/bild-monogram-B-onyx-tile.svg', monogram(IVORY, ONYX))
print('wrote', len(os.listdir('01-logos/svg')), 'logo svgs +', len(os.listdir('02-mark-monogram/svg')), 'mark svgs')
