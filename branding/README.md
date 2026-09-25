# BILD Brand Pack

The complete visual identity for **BILD - British Indians Living in Dubai**.
Modern Minimal identity. Established 2019.

**Strapline:** Belong. Connect. Grow.

*Last reviewed: 22 September 2026*

---

## Premium Gold changed in September 2026

The identity and the website had drifted apart: the logo, social assets and
every automated email used `#C8A64B`, while the website used `#C8861A`. The
crown in the navigation bar was a different gold from the button beside it.

**Resolved in favour of the website's gold.** `#C8861A` is now Premium Gold
everywhere. It is more saturated and reads brighter on screen, particularly
against the dark hero, where `#C8A64B` looked washed out. Every vector master
in this pack has been updated, along with the website, the emails and the app
icon.

All PNG and JPG exports were re-rendered from the masters on 22 September 2026
and now carry `#C8861A`. Nothing in this pack still uses the retired gold.

The dark ground also moved, in the other direction: the website adopted the
identity's Onyx `#0E0E0E` in place of Tailwind's blue-tinted slate, so the two
now agree.

---

## The crown, and where it came from

> **Superseded 22 September 2026.** The section below records the decision to
> adopt the *website's* crown pack-wide. That has since been reversed: the
> **original logo's** crown is now the mark everywhere in this pack. The
> history is kept because it explains why three different crowns existed.

### The crown was corrected in September 2026

The pack and the website had been drawing **different crowns**, and the
September colour work did not catch it because only the palette was compared.

- The **website** (`public/bild-logo-new.svg`) uses three *separate* slender
  spikes on a *detached* base bar, with three dots above the tips.
- The **pack** used a single continuous zigzag polygon: the three peaks joined
  into one solid mass with the valleys filled and the base fused on.

They were not two exports of one mark. They were two different drawings. Every
file in the pack inherited the wrong one, because the mark, the monogram, the
favicons and the social assets were all built from the same polygon.

**Resolved in favour of the website**, on the same reasoning that settled the
gold. `_rebuild.py` and `_rebuild2.py` (kept in this folder) regenerate every
vector master from one `crown()` function whose coordinates are lifted straight
from the website's SVG, so the two cannot drift apart again silently.

The wordmark moved with it. The pack set B.I.L.D in **Playfair Display** pulled
from Google Fonts; the website sets it in **Georgia**. Georgia now wins, which
has a practical benefit beyond consistency: Georgia is a system face, so the
SVGs rasterise correctly inside an `<img>`. The Playfair masters silently fell
back to a default serif whenever anything rendered them without network access,
which is one reason the old exports never quite matched the vectors.

Playfair Display remains the display face for *headlines* on the website. This
change is about the logo lockup only.

Still different, and deliberately so: the identity specifies **Montserrat** for
body copy, the website uses **Inter**. Changing that alters the feel of every
page and is a separate decision. The display face, Playfair Display, matches.

---

## Colour palette (identity)

| Colour | HEX | RGB | Use |
|---|---|---|---|
| Onyx Black | `#0E0E0E` | 14, 14, 14 | Primary dark / backgrounds |
| Premium Gold | `#C8861A` | 200, 134, 26 | Lead accent, crown, highlights |
| Ivory | `#F4F1EC` | 244, 241, 236 | Light backgrounds, reversed text |
| Stone Grey | `#D9D7D2` | 217, 215, 210 | Supporting neutral |

## Colour palette (website, as built)

Defined in `bild-website/tailwind.config.ts`.

| Token | HEX | Use |
|---|---|---|
| `charcoal-900` | `#0E0E0E` | Darkest section ground (hero) - Onyx |
| `charcoal-800` | `#1A1A1A` | Dark section ground |
| `charcoal-700` | `#2E2E2E` | Body text on light grounds |
| `charcoal-600` | `#4A4A4A` | Secondary text on light grounds |
| `gold-500` | `#C8861A` | Primary button and link accent - Premium Gold |
| `gold-600` / `gold-700` | `#a86a10` / `#7d4e0a` | Accent text on light grounds |
| `gold-400` | `#e0a135` | Accent on dark grounds |
| `gold-200` | `#f4d99b` | Borders on light sections |
| `gold-100` | `#faefd9` | Emphasis band (the stats section) |
| `cream` | `#fdf8f0` | Default light section ground |
| `stone-100` | `#E9E4DB` | Third section ground *(added Sept 2026)* |
| `stone-200` | `#D9D1C2` | Borders on a stone section |
| `stone-50` | `#F4F1EB` | Subtle band inside a cream section |
| `ruby-500` | `#9B2335` | Secondary accent, used sparingly |

### Two traps in the website palette

- **`gold-50` is the identical hex to `cream`** (`#fdf8f0`). It looks like a
  third light tone but is not, so alternating sections between them changes
  nothing on screen. It is used in about twenty small components, so its value
  cannot safely be changed. Reach for `stone-50` instead when you want a subtly
  different panel.
- **`charcoal` only defines 600 to 900.** `text-charcoal-500` silently falls
  back to Tailwind's default grey, which is cooler than the rest of the palette.

### Section rhythm

The public pages alternate between light and dark grounds, with the dark
sections acting as the dividers. Three light tones are available: `cream`,
`gold-100` for emphasis, and `stone-100`. Avoid placing two sections of the same
ground next to each other.

Contrast on `stone-100`, checked rather than assumed: `charcoal-800` 11.6:1,
`charcoal-600` 6.0:1, `gold-700` 5.6:1. `gold-600` is 3.5:1, which is fine for
headings and large figures but not for small body text.

## Typography

- **Playfair Display** (Bold) - headlines. Used on the website as
  `font-display`. *Not* the logo wordmark: see the crown section above.
- **Georgia** (Bold) - the B.I.L.D logo wordmark, in the logo files only.
- **Montserrat** (Regular / Medium) - body copy and supporting text in the
  identity. **Note:** the website uses Inter for body copy instead. See the
  drift note above.

---

## Folder guide

```
branding/
├── 01-logos/
│   ├── svg/   Vector masters (infinite scale, editable)
│   │   ├── bild-logo-primary.svg     Gold crown + ivory text (dark backgrounds)
│   │   ├── bild-logo-reversed.svg    Gold crown + onyx text (light backgrounds)
│   │   ├── bild-logo-gold.svg        All gold
│   │   ├── bild-logo-white.svg       All ivory / white (reverse)
│   │   ├── bild-logo-black.svg       All onyx (monochrome)
│   │   ├── bild-logo-motif.svg       Subtle circular mandala motif (dark backgrounds)
│   │   └── bild-logo-motif-light.svg Subtle circular mandala motif (light backgrounds)
│   └── png/   Hi-res transparent PNG (@2000 and @1000) + solid-bg JPGs
│
├── 02-mark-monogram/
│   ├── svg/   Crown mark + "B" monogram (vector)
│   └── png/   Transparent PNG exports
│
├── 03-favicon/
│   ├── favicon.ico            Multi-size (16/32/48)
│   ├── favicon-16/32/48/180/192/512.png
│   ├── apple-touch-icon.png   180x180
│   ├── android-chrome-192/512.png
│   └── site.webmanifest
│
├── 04-social/
│   ├── profile-avatar-1080.png        Instagram / Facebook / LinkedIn / WhatsApp
│   ├── open-graph-1200x630.png/.jpg   Link previews (WhatsApp, X, FB, LinkedIn)
│   ├── facebook-cover-1640x624.png
│   ├── linkedin-banner-1584x396.png
│   └── x-header-1500x500.png
│
└── 05-guidelines/
    └── BILD-Brand-Guidelines.pdf      Logo usage, clear space, colour, type, do's & don'ts
```

**Note on the PDF:** `BILD-Brand-Guidelines.pdf` is now two revisions behind.
It carries the original palette, and it shows the old zigzag crown throughout.
Treat this README as the current reference until the PDF is reissued.

## Quick usage

- **Dark backgrounds** -> use `bild-logo-primary`
- **Light backgrounds** -> use `bild-logo-reversed`
- **Tiny sizes / avatars / app icons** -> use the crown mark or the "B" monogram
- **Minimum width:** 120px digital, 25mm print. Keep clear space equal to the crown height.

SVGs are the masters. Re-export PNGs from them at any size you need.

---

## Where the brand appears in the product

| Surface | Built from |
|---|---|
| Website | `bild-website/tailwind.config.ts`, Playfair Display + Inter |
| Transactional emails | `bild-website/src/lib/email.ts`, Georgia + Arial |
| Link previews | `public/og-image.png`, 1200x630 |
| Browser tab and home screen | `public/icon.png`, `apple-icon.png`, `favicon.ico`, and the web manifest at `/manifest.webmanifest` (theme colour `#C8861A`) |

## Changelog

- **11 Sept 2026** - Premium Gold changed from `#C8A64B` to `#C8861A`, resolving
  the identity/website split in favour of the website's brighter gold. All SVG
  masters updated; PNG and JPG exports still need re-rendering. The website
  adopted Onyx `#0E0E0E` as its dark ground. Added the `stone` section tone;
  noted that `gold-50` duplicates `cream`; noted the guidelines PDF is behind
  this README.
- **22 Sept 2026** - Crown geometry corrected pack-wide to match the website's
  three-spike mark, replacing the zigzag polygon that every file had inherited.
  Logo wordmark moved from Playfair Display to Georgia, matching the site and
  removing a webfont dependency that broke rasterisation. All PNG, JPG, favicon
  and social exports re-rendered from the corrected masters; `favicon.ico`
  rebuilt at 16/32/48. Pack regeneration is now scripted in `_rebuild.py` and
  `_rebuild2.py`.
- **22 Sept 2026 (later)** - Mandala motif replaced with the **genuine
  artwork**, recovered from `documents/Bild_Logo_Old.pdf`. It was never vector:
  the PDF carries it as a 1442x1436 gold-foil raster plus an alpha mask, which
  is why three attempts at redrawing it in SVG primitives all fell short. Two
  masters are now kept - `01-logos/png/bild-mandala-original@1442.png`
  (untouched, foil texture) and `01-logos/png/bild-mandala-gold@600.png`
  (identical alpha, flattened to Premium Gold: 1.6 MB down to 86 KB). The motif
  lockups embed the flattened one as a data URI, so the geometry is the
  designer's own curves rather than a reconstruction.

  **Consequence:** `bild-logo-motif.svg` and `bild-logo-motif-light.svg` carry
  an embedded raster and are ~230 KB each. They do not scale indefinitely, but
  neither did the source. The five plain logo variants remain pure vector at
  under 1 KB.
- **22 Sept 2026 (motif pass)** - Four fixes after review:
  1. Motif opacity dropped to 0.26. It was overpowering the lockup sitting on
     top of it.
  2. The motif lockups went **mono**: Onyx on light, Ivory on dark. A gold
     crown over a gold mandala read as one texture rather than a mark in front
     of a pattern.
  3. `bild-logo-motif@*.png` and `bild-logo-motif-light@*.png` now carry their
     intended ground baked in (Onyx and Ivory). They were transparent, which
     meant the dark variant's ivory lockup was invisible in any light viewer
     and the light variant's black lockup vanished on dark - the motif
     appeared far stronger than it was, because faint gold composited on a
     viewer's black background reads bright. Alpha stripped afterwards, which
     also took ~45% off each file.

  **Which motif file to use:** `-light` on white, cream or ivory; the plain one
  on Onyx or photography. The JPGs are the same artwork at 1600x1000 for
  anything that will not take a PNG.
- **22 Sept 2026 (transparent motifs)** - Added transparent versions alongside
  the grounded ones, for placing over photography or a colour you choose:
  `bild-logo-motif-transparent@1000/2000.png` (ivory lockup, for dark grounds)
  and `bild-logo-motif-light-transparent@1000/2000.png` (onyx lockup, for
  light grounds). A transparent file has to commit to one lockup colour, which
  is why there are two rather than one.

### Which motif file to use

| Ground | File |
|---|---|
| Onyx or dark | `bild-logo-motif@N.png` (ground baked in) |
| White, cream, ivory | `bild-logo-motif-light@N.png` (ground baked in) |
| Photography, or your own colour, dark | `bild-logo-motif-transparent@N.png` |
| Photography, or your own colour, light | `bild-logo-motif-light-transparent@N.png` |
| Anything that will not take a PNG | `bild-logo-motif-onyx.jpg` / `bild-logo-motif-light-ivory.jpg` |

The grounded PNGs are RGB with no alpha, so they are roughly half the size of
the transparent ones. Reach for a transparent file only when you actually need
the background to show through - on a flat Onyx or Ivory panel the baked-in
version is the smaller, safer choice.
- **22 Sept 2026 (contained motif)** - The motif lockups are now **square and
  contained**, matching the original logo's composition: the mandala frames the
  wordmark instead of sitting behind a wordmark wider than itself. Previously
  B.I.L.D ran out past the pattern on both sides.

  Every ratio was read off the original artwork's own PDF content stream rather
  than estimated, as a fraction of its square canvas:

  | | Original | Notes |
  |---|---|---|
  | Mandala diameter | 0.630 of canvas | leaves a generous margin |
  | B.I.L.D width | 0.804 x mandala | sits well inside the petals |
  | B.I.L.D size / baseline | 0.1420 / 0.5452 | |
  | ESTD size / baseline | 0.0111 / 0.5703 | only 7.8% of B.I.L.D |
  | Crown width / bottom | 0.0750 / 0.4418 | lands just above the cap line |

  `textLength` pins the wordmark to that 0.804, so containment holds whatever
  font actually renders rather than depending on Georgia's metrics.

  All ten motif exports are square now (1000x1000, 2000x2000, JPGs 1600x1600),
  where they were 1000x625 etc. Anything that placed the old landscape file
  will need its frame adjusting.

  **Two deliberate departures from the original:** the ESTD rules are dropped
  (the original has none), and the crown is centred where the original sits it
  over the "I", about 7.7% left of centre. Both are one-line changes in
  `motif_lockup()` if you want the original's exact treatment.
- **22 Sept 2026 (original crown on the motif)** - The motif lockups now carry
  the **original logo's crown**, not the website's. The site draws three
  separate straight-sided spikes; the original is a single filled path with
  tapered spikes, concave flanks, ball finials and a base that bows gently
  upward. Unlike the mandala, the crown in `Bild_Logo_Old.pdf` is real vector,
  so this is the designer's own path extracted from the content stream and
  normalised, not a redrawing.

  Centred, and raised to a base of 0.4180 of the canvas from the original's
  0.4418, so it reads as a separate element above the wordmark rather than
  resting on the cap line.

  **Note the split this creates:** the two motif lockups use the original
  crown, while the five plain variants, the crown mark, the monogram, the
  favicons and the social assets all still use the website's crown. That was
  deliberate - the website remains the master for everything the site renders -
  but if the original crown should be the mark everywhere, it is a one-line
  change in `crown()` and a re-run of both scripts.
- **22 Sept 2026 (original crown pack-wide)** - The original logo's crown is
  now the mark across the **whole** pack, replacing the website's three-spike
  version in the five logo variants, the crown mark, the monogram, every
  favicon and every social asset. 35 rasters re-rendered, `favicon.ico`
  rebuilt at 16/32/48, and the dead alpha stripped from the four full-bleed
  social files (~78% each).

  The path is the designer's own, extracted from the vector crown in
  `documents/Bild_Logo_Old.pdf` and normalised to a 1000-wide box. It lives in
  `CROWN_ORIGINAL` in `_rebuild.py`; `crown()` keeps its old signature so every
  call site placed it without changes.

  One judgement call: the original is 1.80:1 where the primitive crown it
  replaces was 0.89:1, so dropped in at the same width it read squat.
  `SPIKE_LIFT = 1.45` stretches it vertically to sit between the two. Set it to
  1.0 for the original's exact proportions. The motif lockups are unaffected -
  they reproduce the original artwork directly and already used `SPIKE_LIFT`-free
  geometry via `crown_original()`.

  **The website is now the odd one out.** `public/bild-logo-new.svg` (navbar,
  footer, admin nav, admin login) and the deployed icons still draw the
  three-spike crown. Bringing them across is a separate, visible change to the
  live site.
- **22 Sept 2026 (final pass)** - Three changes:
  1. The rules either side of ESTD 2019 are reinstated on the motif lockups,
     matching the plain variants. All ten motif exports re-rendered.
  2. **The website now carries the original crown.** `public/bild-logo-new.svg`
     (navbar, footer, admin nav, admin login) plus `icon.png`,
     `apple-icon.png`, `favicon.ico` and `og-image.png` were replaced from this
     pack and deployed. The site and the pack draw the same mark again, for the
     first time since the identity and the product diverged. Previous files are
     in `bild-website/.icon-backup-20260922-crown/`.
  3. `05-guidelines/BILD-Brand-Guidelines.pdf` **reissued** - seven pages,
     generated from the pack by `_guidelines.py` rather than maintained by
     hand, so it cannot silently fall behind again. It previously carried the
     retired `#C8A64B` and the three-spike crown throughout.
- **22 Sept 2026 (real type specimens)** - Playfair Display, Montserrat and
  Inter installed and the guidelines regenerated. The document is now set in
  the brand's own type system: Playfair Display Bold for headings, Montserrat
  for all body copy, Georgia only where the logo wordmark is shown, Inter only
  on the typography page so the website's body face appears as itself.
  Previously every specimen was a stand-in - Playfair shown in Georgia,
  Montserrat and Inter shown in Helvetica - which is a poor look on the one
  page whose job is to show the faces.

  The fonts are vendored in `branding/_fonts/` so `_guidelines.py` builds an
  identical PDF anywhere, and also installed to `~/Library/Fonts`. All are SIL
  Open Font License, so shipping them with the pack is permitted; see
  `_fonts/OFL-NOTICE.txt`.
- **22 Sept 2026 (new strapline)** - The strapline changed from *Building
  Legacy . Inspiring Growth . Living Purpose* to **Belong . Connect . Grow**.
  It is set once, as `STRAP` in `_rebuild2.py`, and flows into every social
  template from there; the guidelines cover and this README were updated to
  match. The five rendered assets that carry it were re-exported: the Open
  Graph PNG and JPG, the Facebook cover, the LinkedIn banner and the X header.
  Tracking on the line went from 4.5 to 7.5 units, because the new strapline is
  less than half as long and looked cramped at the old spacing.

  `bild-website/public/og-image.png` was updated to match but **is not
  deployed** - every existing BILD link preview still shows the old strapline
  until it is.
