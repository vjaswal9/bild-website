"""Regenerates 05-guidelines/BILD-Brand-Guidelines.pdf from the pack itself.

The previous PDF was two revisions behind: it carried the retired #C8A64B gold
and showed the old three-spike crown throughout. Everything here is read from
the current assets, so the document cannot drift from the pack again without
someone editing this file.
"""
import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

W, H = landscape(A4)
ONYX, GOLD, IVORY, STONE = '#0E0E0E', '#C8861A', '#F4F1EC', '#D9D7D2'
CHAR = '#2E2E2E'
c = HexColor

# The brand's own faces, vendored in branding/_fonts so this builds identically
# on any machine rather than depending on what happens to be installed. They are
# also installed to ~/Library/Fonts for everyday use. Both are SIL Open Font
# License, so redistributing them alongside the pack is fine.
_F = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_fonts')
pdfmetrics.registerFont(TTFont('Geo',   '/System/Library/Fonts/Supplemental/Georgia.ttf'))
pdfmetrics.registerFont(TTFont('GeoB',  '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'))
pdfmetrics.registerFont(TTFont('Play',  os.path.join(_F, 'PlayfairDisplay-Regular.ttf')))
pdfmetrics.registerFont(TTFont('PlayB', os.path.join(_F, 'PlayfairDisplay-Bold.ttf')))
pdfmetrics.registerFont(TTFont('Mont',  os.path.join(_F, 'Montserrat-Regular.ttf')))
pdfmetrics.registerFont(TTFont('MontM', os.path.join(_F, 'Montserrat-Medium.ttf')))
pdfmetrics.registerFont(TTFont('MontB', os.path.join(_F, 'Montserrat-SemiBold.ttf')))
# Inter is here only so the website's body face can be shown as itself on the
# typography page. Nothing else in this document is set in it.
pdfmetrics.registerFont(TTFont('Inter', os.path.join(_F, 'Inter-Regular.ttf')))

# The document sets itself in the brand's own type system: Playfair Display for
# display, Montserrat for everything else. Georgia appears only where the logo
# wordmark is being shown, because that is what the wordmark is set in.
SANS, SANSB, DISP = 'Mont', 'MontB', 'PlayB'


def cmyk(hexstr):
    r, g, b = (int(hexstr[i:i+2], 16)/255 for i in (1, 3, 5))
    k = 1 - max(r, g, b)
    if k >= 1: return (0, 0, 0, 100)
    f = lambda v: round((1 - v - k) / (1 - k) * 100)
    return (f(r), f(g), f(b), round(k*100))


class Doc:
    def __init__(self, path):
        self.c = canvas.Canvas(path, pagesize=(W, H))
        self.c.setTitle('BILD Brand Guidelines')
        self.c.setAuthor('BILD - British Indians Living in Dubai')
        self.c.setSubject('Visual identity: logo, crown, mandala, colour, type')

    def page(self, title=None, kicker=None, dark=False):
        cv = self.c
        cv.setFillColor(c(ONYX if dark else IVORY))
        cv.rect(0, 0, W, H, fill=1, stroke=0)
        if title:
            cv.setFillColor(c(GOLD))
            cv.setFont(SANSB, 8.5)
            cv.drawString(48, H-52, (kicker or '').upper())
            cv.setFillColor(c(IVORY if dark else ONYX))
            cv.setFont(DISP, 25)
            cv.drawString(48, H-84, title)
            cv.setStrokeColor(c(GOLD)); cv.setLineWidth(1.4)
            cv.line(48, H-98, 128, H-98)
        return cv

    def foot(self, n, dark=False):
        cv = self.c
        cv.setFillColor(c('#6b6b6b' if not dark else '#7a7a7a'))
        cv.setFont(SANS, 7)
        cv.drawString(48, 26, 'BILD Brand Guidelines  ·  Revised 22 September 2026')
        cv.drawRightString(W-48, 26, str(n))
        cv.showPage()

    def img(self, path, x, y, w, h, label=None, sub=None, ground=None, dark=False):
        cv = self.c
        if ground:
            cv.setFillColor(c(ground)); cv.roundRect(x, y, w, h, 5, fill=1, stroke=0)
        ir = ImageReader(path); iw, ih = ir.getSize()
        pad = 12
        k = min((w-2*pad)/iw, (h-2*pad)/ih)
        cv.drawImage(ir, x+(w-iw*k)/2, y+(h-ih*k)/2, iw*k, ih*k, mask='auto')
        if label:
            cv.setFillColor(c('#9a9a9a' if dark else '#6b6b6b'))
            cv.setFont(SANSB, 6.6); cv.drawString(x, y-11, label.upper())
        if sub:
            cv.setFillColor(c('#7a7a7a')); cv.setFont(SANS, 6.4)
            cv.drawString(x, y-20, sub)

    def body(self, text, x, y, size=8.6, leading=12.4, width=300, dark=False, colour=None):
        cv = self.c
        cv.setFillColor(c(colour or ('#c9c4bb' if dark else '#4a4a4a')))
        cv.setFont(SANS, size)
        words, line, yy = text.split(), '', y
        for wd in words:
            t = (line + ' ' + wd).strip()
            if cv.stringWidth(t, SANS, size) > width:
                cv.drawString(x, yy, line); line = wd; yy -= leading
            else:
                line = t
        if line: cv.drawString(x, yy, line); yy -= leading
        return yy

    def save(self): self.c.save()


d = Doc('05-guidelines/BILD-Brand-Guidelines.pdf')
L, MP, FV, SO = '01-logos/png/', '02-mark-monogram/png/', '03-favicon/', '04-social/'

# ---------------------------------------------------------------- 1. cover
cv = d.page(dark=True)
d.img(L+'bild-logo-motif@2000.png', W/2-150, H/2-118, 300, 300)
cv.setFillColor(c(GOLD)); cv.setFont(SANSB, 9)
cv.drawCentredString(W/2, H/2-150, 'B R A N D   G U I D E L I N E S')
cv.setFillColor(c('#9a958c')); cv.setFont(SANS, 8)
cv.drawCentredString(W/2, H/2-168, 'Belong  ·  Connect  ·  Grow')
cv.drawCentredString(W/2, H/2-182, 'British Indians Living in Dubai  ·  Established 2019')
d.foot(1, dark=True)

# ---------------------------------------------------------------- 2. the logo
cv = d.page('The Logo', 'Core identity')
d.body('Six lockups cover every ground. The primary sits on dark, the reversed on light, and the '
       'monochrome pair exists for single-colour printing. The motif lockups are the full mark: the '
       'mandala frames the wordmark rather than sitting behind it.', 48, H-124, width=430)
gy, gw, gh = H-300, 174, 132
for i, (f, lab, sub, gr) in enumerate([
    (L+'bild-logo-primary@1000.png',  'Primary',   'gold crown, ivory wordmark - dark grounds', ONYX),
    (L+'bild-logo-reversed@1000.png', 'Reversed',  'gold crown, charcoal wordmark - light grounds', '#ffffff'),
    (L+'bild-logo-gold@1000.png',     'All gold',  'single colour, on onyx', ONYX),
    (L+'bild-logo-black@1000.png',    'All onyx',  'single colour, monochrome print', '#ffffff'),
]):
    d.img(f, 48+i*(gw+16), gy, gw, gh, lab, sub, gr)
gy2 = gy-176
for i, (f, lab, sub, gr) in enumerate([
    (L+'bild-logo-motif@1000.png',       'Motif (dark)',  'the contained lockup, on onyx', ONYX),
    (L+'bild-logo-motif-light@1000.png', 'Motif (light)', 'the contained lockup, on ivory', '#ffffff'),
]):
    d.img(f, 48+i*(150+16), gy2, 150, 150, lab, sub, gr)
tx = 48+2*(150+16)+24
cv.setFillColor(c(ONYX)); cv.setFont(SANSB, 9); cv.drawString(tx, gy2+132, 'CLEAR SPACE')
d.body('Keep clear space around the logo equal to the height of the crown on every side. Nothing - '
       'type, rules, photography, page edges - enters that margin.', tx, gy2+116, width=300)
cv.setFillColor(c(ONYX)); cv.setFont(SANSB, 9); cv.drawString(tx, gy2+62, 'MINIMUM SIZE')
d.body('120px wide on screen, 25mm in print. Below that the wordmark closes up: use the crown mark '
       'or the B monogram instead.', tx, gy2+46, width=300)
d.foot(2)

# ---------------------------------------------------------- 3. crown & mandala
cv = d.page('The Crown and the Mandala', 'The two elements')
d.body('Both come from the original 2019 artwork. The crown is a single filled path - tapered spikes '
       'with concave flanks, ball finials and a base that bows gently upward. The mandala is '
       'twelve-fold: an outer ring of loops, a scalloped band, petals carrying graduated dots, and a '
       'starburst at the centre.', 48, H-124, width=424)
d.img(MP+'bild-mark-crown-onyx@1000.png', 48, H-330, 215, 150, 'The crown', 'the mark at scale', '#ffffff')
d.img(L+'bild-mandala-gold@600.png',      285, H-346, 190, 190, 'The mandala', 'twelve-fold, Premium Gold', '#ffffff')
tx = 500
cv.setFillColor(c(ONYX)); cv.setFont(SANSB, 9); cv.drawString(tx, H-140, 'PROVENANCE')
d.body('Both were recovered from the original logo file. The crown is real vector, so the path in use '
       'is the designer’s own. The mandala was never vector - it exists as a 1442 x 1436 gold-foil '
       'raster - so it is kept twice: untouched at bild-mandala-original@1442.png, and flattened to '
       'Premium Gold at bild-mandala-gold@600.png, which is what the lockups carry.',
       tx, H-156, width=294)
cv.setFillColor(c(ONYX)); cv.setFont(SANSB, 9); cv.drawString(tx, H-244, 'USING THEM APART')
d.body('The crown may stand alone as a mark. The mandala may be used as a watermark or a background '
       'texture, but never at full strength behind type - it is set at 26% in the lockups for exactly '
       'that reason. Neither element is ever redrawn by hand.', tx, H-260, width=294)
cv.setFillColor(c(ONYX)); cv.setFont(SANSB, 9); cv.drawString(48, H-390, 'REGENERATION')
d.body('Every master in this pack is produced by branding/_rebuild.py and _rebuild2.py from one crown '
       'definition and one mandala file. Re-running them reproduces the pack byte for byte, so the '
       'identity cannot drift between the guidelines, the pack and the website.', 48, H-406, width=470)
d.foot(3)

# -------------------------------------------------- 4. mark, monogram & icons
cv = d.page('Mark, Monogram and Icons', 'Small sizes')
d.body('For tight spaces, avatars, app icons and watermarks - anywhere the full lockup would fall '
       'below its minimum size.', 48, H-124, width=470)
d.img(MP+'bild-mark-crown-gold@1000.png',        48, H-300, 170, 130, 'Crown mark', 'on onyx', ONYX)
d.img(MP+'bild-monogram-B-onyx-tile@1000.png',  236, H-300, 130, 130, 'Monogram', 'the app icon tile', ONYX)
for i, s in enumerate([64, 48, 32, 16]):
    x = 400 + i*74
    d.img(FV+'favicon-512.png', x, H-250, s, s)
    cv.setFillColor(c('#6b6b6b')); cv.setFont(SANS, 6.4)
    cv.drawString(x, H-262, f'{s}px')
cv.setFillColor(c(ONYX)); cv.setFont(SANSB, 9); cv.drawString(400, H-160, 'FAVICON AND APP ICONS')
d.body('favicon.ico carries 16, 32 and 48. Larger PNGs cover Apple touch and Android.', 400, H-176, width=290)
d.img(SO+'profile-avatar-1080.png', 48, H-470, 140, 140, 'Profile avatar', 'Instagram, Facebook, LinkedIn, WhatsApp', ONYX)
d.img(SO+'open-graph-1200x630.png', 206, H-470, 268, 140, 'Link preview', 'Open Graph, 1200 x 630', ONYX)
cv.setFillColor(c(ONYX)); cv.setFont(SANSB, 9); cv.drawString(500, H-350, 'SOCIAL SIZES')
for i, t in enumerate(['Profile avatar  1080 x 1080', 'Open Graph  1200 x 630',
                       'Facebook cover  1640 x 624', 'LinkedIn banner  1584 x 396',
                       'X header  1500 x 500']):
    cv.setFillColor(c('#4a4a4a')); cv.setFont(SANS, 8)
    cv.drawString(500, H-368-i*13, '·  ' + t)
d.foot(4)

# ------------------------------------------------------------- 5. colour
cv = d.page('Colour Palette', 'Identity')
d.body('Gold leads; onyx grounds; ivory and stone provide calm space. Premium Gold changed in '
       'September 2026 from #C8A64B to #C8861A, resolving a long-standing split between the identity '
       'and the website in favour of the website’s brighter gold. Anything still showing the old '
       'value is out of date.', 48, H-124, width=470)
sw = [('Onyx Black', ONYX, 'Primary dark, backgrounds'),
      ('Premium Gold', GOLD, 'Lead accent, crown, highlights'),
      ('Ivory', IVORY, 'Light backgrounds, reversed text'),
      ('Stone Grey', STONE, 'Supporting neutral')]
for i, (name, hx, use) in enumerate(sw):
    x = 48 + i*174
    cv.setFillColor(c(hx)); cv.roundRect(x, H-300, 158, 96, 4, fill=1, stroke=0)
    if hx in (IVORY, STONE):
        cv.setStrokeColor(c('#cfc9bf')); cv.setLineWidth(0.5)
        cv.roundRect(x, H-300, 158, 96, 4, fill=0, stroke=1)
    cv.setFillColor(c(ONYX)); cv.setFont(SANSB, 9); cv.drawString(x, H-318, name)
    r, g, b = (int(hx[j:j+2], 16) for j in (1, 3, 5))
    cy, m, yl, k = cmyk(hx)
    cv.setFillColor(c('#4a4a4a')); cv.setFont(SANS, 7)
    cv.drawString(x, H-330, f'HEX {hx.upper()}')
    cv.drawString(x, H-340, f'RGB {r} {g} {b}')
    cv.drawString(x, H-350, f'CMYK {cy} {m} {yl} {k}')
    cv.setFillColor(c('#7a7a7a')); cv.setFont(SANS, 6.6); cv.drawString(x, H-362, use)
cv.setFillColor(c(ONYX)); cv.setFont(SANSB, 9); cv.drawString(48, H-396, 'THE WEBSITE PALETTE')
d.body('The site extends the identity with working tints. These are defined once in '
       'bild-website/tailwind.config.ts and should not be re-invented per page.', 48, H-412, width=470)
tok = [('gold-400', '#e0a135', 'accent on dark'), ('gold-500', '#C8861A', 'primary button'),
       ('gold-600', '#a86a10', 'accent text on light'), ('gold-700', '#7d4e0a', 'small accent text'),
       ('cream', '#fdf8f0', 'default light ground'), ('stone-100', '#E9E4DB', 'third ground'),
       ('charcoal-800', '#1A1A1A', 'dark section'), ('ruby-500', '#9B2335', 'used sparingly')]
for i, (n, hx, use) in enumerate(tok):
    col, row = i % 4, i // 4
    x, y = 48 + col*174, H-452 - row*34
    cv.setFillColor(c(hx)); cv.roundRect(x, y, 22, 22, 3, fill=1, stroke=0)
    if hx.lower() in ('#fdf8f0', '#e9e4db'):
        cv.setStrokeColor(c('#cfc9bf')); cv.setLineWidth(0.5); cv.roundRect(x, y, 22, 22, 3, fill=0, stroke=1)
    cv.setFillColor(c(ONYX)); cv.setFont(SANSB, 7.4); cv.drawString(x+29, y+13, n)
    cv.setFillColor(c('#7a7a7a')); cv.setFont(SANS, 6.6)
    cv.drawString(x+29, y+4, f'{hx.upper()}  ·  {use}')
d.foot(5)

# --------------------------------------------------------- 6. typography
cv = d.page('Typography', 'Type system')
cv.setFillColor(c(ONYX)); cv.setFont(DISP, 38); cv.drawString(48, H-176, 'Playfair Display')
cv.setFillColor(c(GOLD)); cv.setFont(SANSB, 8); cv.drawString(48, H-194, 'PRIMARY  ·  DISPLAY')
d.body('Headlines and feature titles. Set bold, with generous tracking on short lines. This document '
       'is set in it.', 48, H-210, width=330)
cv.setFillColor(c(ONYX)); cv.setFont('GeoB', 40); cv.drawString(48, H-282, 'Georgia')
cv.setFillColor(c(GOLD)); cv.setFont(SANSB, 8); cv.drawString(48, H-300, 'THE LOGO WORDMARK')
d.body('B.I.L.D is set in Georgia, not Playfair. It is a system face, so the logo files render '
       'correctly anywhere without fetching a webfont - which is why earlier exports that relied on '
       'Playfair silently fell back to a default serif.', 48, H-316, width=330)
cv.setFillColor(c(ONYX)); cv.setFont('MontM', 34); cv.drawString(430, H-176, 'Montserrat')
cv.setFillColor(c(GOLD)); cv.setFont(SANSB, 8); cv.drawString(430, H-194, 'SECONDARY  ·  BODY')
d.body('Body copy, buttons, labels and supporting text across the identity. Every word of body copy '
       'in this document is set in it.', 430, H-210, width=330)
cv.setFillColor(c(ONYX)); cv.setFont('Inter', 34); cv.drawString(430, H-268, 'Inter')
cv.setFillColor(c(GOLD)); cv.setFont(SANSB, 8); cv.drawString(430, H-286, 'THE WEBSITE BODY FACE')
d.body('The website uses Inter for body copy rather than Montserrat. This is a known and deliberate '
       'difference: changing it alters the feel of every page, and is a separate decision. The '
       'display face matches.', 430, H-302, width=330)
d.foot(6)

# ------------------------------------------------------- 7. do, don't, index
cv = d.page('Using the Identity', 'Do and do not')
cv.setFillColor(c('#1d6b3a')); cv.setFont(SANSB, 9); cv.drawString(48, H-130, 'DO')
for i, t in enumerate([
    'Use the primary lockup on dark grounds and the reversed on light.',
    'Keep clear space equal to the crown height, and respect the minimum sizes.',
    'Use Premium Gold #C8861A as the lead accent.',
    'Reach for the crown mark or the B monogram when space is tight.',
    'Take files from this pack rather than re-exporting from a screenshot.',
    'Use a grounded motif file on flat colour; the transparent one only over photography.']):
    cv.setFillColor(c('#4a4a4a')); cv.setFont(SANS, 8.4)
    cv.drawString(48, H-150-i*15, '·  ' + t)
cv.setFillColor(c('#8a2b2b')); cv.setFont(SANSB, 9); cv.drawString(430, H-130, 'DO NOT')
for i, t in enumerate([
    'Do not recolour the logo outside the palette.',
    'Do not use the retired gold #C8A64B anywhere.',
    'Do not stretch, rotate, outline or add shadows.',
    'Do not redraw the crown or the mandala by hand.',
    'Do not place the dark logo on a busy or low-contrast background.',
    'Do not set the mandala at full strength behind type.']):
    cv.setFillColor(c('#4a4a4a')); cv.setFont(SANS, 8.4)
    cv.drawString(430, H-150-i*15, '·  ' + t)
cv.setFillColor(c(ONYX)); cv.setFont(SANSB, 9); cv.drawString(48, H-268, 'WHAT IS IN THE PACK')
rows = [('01-logos/svg', 'Vector masters - seven lockups'),
        ('01-logos/png', 'Hi-res PNG at 1000 and 2000, plus solid-ground JPGs'),
        ('02-mark-monogram', 'Crown mark and B monogram, vector and PNG'),
        ('03-favicon', 'favicon.ico plus every PNG size and the web manifest'),
        ('04-social', 'Avatar, Open Graph, Facebook, LinkedIn and X'),
        ('05-guidelines', 'This document'),
        ('README.md', 'The current reference, with the full change history')]
for i, (a, b) in enumerate(rows):
    y = H-288-i*15
    cv.setFillColor(c(ONYX)); cv.setFont(SANSB, 7.6); cv.drawString(48, y, a)
    cv.setFillColor(c('#4a4a4a')); cv.setFont(SANS, 7.6); cv.drawString(186, y, b)
cv.setFillColor(c(GOLD)); cv.setFont(SANSB, 8); cv.drawString(430, H-268, 'THIS REVISION')
d.body('Revised 22 September 2026. Premium Gold corrected to #C8861A; the original crown adopted '
       'across the whole pack, replacing a three-spike version that never matched the 2019 artwork; '
       'the mandala restored from the original file; the motif lockups rebuilt square and contained. '
       'branding/README.md carries the full history, and is the reference if this document and the '
       'pack ever disagree.', 430, H-284, width=330)
d.foot(7)

d.save()
print('written:', os.path.getsize('05-guidelines/BILD-Brand-Guidelines.pdf'), 'bytes')
