// The photographs in the homepage hero.
//
// One list, used by the homepage and by the unlisted preview page, so the two
// can never drift apart and a photograph is added or dropped in one place.
//
// Each is exported at its own full frame, nothing cropped away beforehand, so
// the hero has the most to show. `position` says which band of a photograph to
// keep when the hero is wider than the photograph is, which is most of the time
// on a desktop. `mobileSrc` is a tighter second crop used only on a phone, for
// a wide shot whose subject would otherwise be too small to make out.

export type HeroPhoto = {
  src: string
  alt: string
  position?: string
  mobileSrc?: string
  // How hard to hold this photograph back behind the headline, as the alpha at
  // the left edge of the scrim. See heroScrim below for why it is per-photo.
  scrim?: number
}

// The scrim: black laid over the photograph, heaviest on the left where the
// words sit and clearing to the right so the photograph is still a photograph.
//
// It used to be one fixed gradient for all ten, starting at 0.94. That was set
// for the darkest photograph in the set and it erased the brightest: measured
// on the live page, the beach arrived at the browser averaging 143 out of 255
// across its left tenth and was painted down to 18, which is indistinguishable
// from black. The photograph was fine; it was being blacked out.
//
// So each photograph now says how much it needs. The numbers were measured
// rather than guessed - each one's mean luminance across its left 35%, the band
// the headline occupies - and chosen to land that band near 55 out of 255:
//
//     alpha = clamp(1 - 55 / leftLuminance, 0.34, 0.80)
//
// The floor of 0.34 matters. A mean hides bright patches, and a dark
// photograph with a spotlight in the wrong place would still fight the type,
// so nothing goes completely bare. At 55 white text sits around 13:1, well
// clear of the 4.5:1 minimum, with headroom for those patches.
//
// The shape of the falloff is kept from the original gradient, which was
// right - only its starting weight was wrong.
const SCRIM_FALLOFF = [1, 0.915, 0.479, 0.266]
const SCRIM_STOPS = [0, 28, 62, 100]
const DEFAULT_SCRIM = 0.55

export function heroScrim(photo: { scrim?: number }): string {
  const lead = photo.scrim ?? DEFAULT_SCRIM
  const stops = SCRIM_FALLOFF.map((f, i) => `rgba(10,8,6,${(lead * f).toFixed(3)}) ${SCRIM_STOPS[i]}%`)
  return `linear-gradient(100deg, ${stops.join(', ')})`
}

const DANCE: HeroPhoto = { src: '/images/hero/hero-dance.jpg', alt: 'A BILD member dancing at a community night in Dubai', position: 'center 45%', scrim: 0.34 }  // left 35% measures 21/255
const BEACH: HeroPhoto = { src: '/images/hero/hero-beach.jpg', alt: 'BILD members together at a morning beach meet-up in Dubai', position: 'center 42%', scrim: 0.51 }  // left 35% measures 113/255
const SINGER: HeroPhoto = { src: '/images/hero/hero-singer.jpg', alt: 'A singer performing to BILD members at a gala night', position: 'center 55%', scrim: 0.34 }  // left 35% measures 35/255

// The padel court is a wide shot with the player off to the right. It reads
// well across a desktop hero, but on a phone she is a speck, so the phone gets
// a crop of the right hand side where she actually is.
const PADEL: HeroPhoto = {
  src: '/images/hero/hero-padel.jpg',
  mobileSrc: '/images/hero/hero-padel-mobile.jpg',
  alt: 'A BILD padel match on a court above Dubai Marina',
  position: 'center 50%',
  scrim: 0.57,  // left 35% measures 129/255
}

const COUPLE: HeroPhoto = { src: '/images/hero/hero-couple.jpg', alt: 'Two BILD members on the dance floor at a BILD party', position: 'center 45%', scrim: 0.38 }  // left 35% measures 89/255
// Four to three, so the wide desktop hero cuts roughly a quarter of its height
// away. Biased upward to keep all three riders' faces and lose road instead.
const CYCLE: HeroPhoto = { src: '/images/hero/hero-cycle.jpg', alt: 'BILD members out on a morning ride in Dubai', position: 'center 42%', scrim: 0.58 }  // left 35% measures 131/255
const PARTY: HeroPhoto = { src: '/images/hero/hero-party.jpg', alt: 'BILD members celebrating together on a night out', position: 'center 48%', scrim: 0.34 }  // left 35% measures 45/255
const GOLF: HeroPhoto = { src: '/images/hero/hero-golf.jpg', alt: 'BILD members at the driving range on a golf evening', position: 'center 55%', scrim: 0.6 }  // left 35% measures 136/255
const SUNRISE: HeroPhoto = { src: '/images/hero/hero-sunrise.jpg', alt: 'BILD members stopped together on a sunrise ride in Dubai', position: 'center 48%', scrim: 0.62 }  // left 35% measures 145/255
const GOLDEN: HeroPhoto = { src: '/images/hero/hero-golden.jpg', alt: 'BILD members dancing at a community dinner', position: 'center 45%', scrim: 0.34 }  // left 35% measures 53/255

const KARVA: HeroPhoto = { src: '/images/hero/hero-karva.jpg', alt: 'BILD members celebrating Karva Chauth together in Dubai', position: 'center 40%', scrim: 0.61 }  // left 35% measures 141/255
const CRICKET: HeroPhoto = { src: '/images/hero/hero-cricket.jpg', alt: 'BILD members cheering on India together at a cricket match in Dubai', position: 'center 40%', scrim: 0.55 }  // left 35% measures 122/255

// Ordered so a dark room never follows a dark room, and daylight never follows
// daylight. The change of scene is the point of the cross-fade, and two similar
// frames in a row waste one. The two riding photographs are kept apart for the
// same reason.
//
// The beach goes first deliberately. The first photograph is the one every new
// visitor sees, and it is seen through the scrim, which is at its heaviest over
// the left where the headline sits. Measured across the whole frame, the beach
// is the brightest of the ten at 123 out of 255 and the dance floor the darkest
// at 37, falling to 24 down its left third. Opening on the dance floor meant
// opening on what looked like a black screen with type on it. It is a fine
// photograph once the eye has something to compare it with, so it now closes
// the cycle instead of starting it.
export const HERO_PHOTOS: HeroPhoto[] = [
  BEACH, SINGER, PADEL, COUPLE, CYCLE, PARTY, CRICKET, GOLF, SUNRISE, GOLDEN, KARVA, DANCE,
]
