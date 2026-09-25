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
}

const DANCE: HeroPhoto = { src: '/images/hero/hero-dance.jpg', alt: 'A BILD member dancing at a community night in Dubai', position: 'center 45%' }
const BEACH: HeroPhoto = { src: '/images/hero/hero-beach.jpg', alt: 'BILD members together at a morning beach meet-up in Dubai', position: 'center 42%' }
const SINGER: HeroPhoto = { src: '/images/hero/hero-singer.jpg', alt: 'A singer performing to BILD members at a gala night', position: 'center 55%' }

// The padel court is a wide shot with the player off to the right. It reads
// well across a desktop hero, but on a phone she is a speck, so the phone gets
// a crop of the right hand side where she actually is.
const PADEL: HeroPhoto = {
  src: '/images/hero/hero-padel.jpg',
  mobileSrc: '/images/hero/hero-padel-mobile.jpg',
  alt: 'A BILD padel match on a court above Dubai Marina',
  position: 'center 50%',
}

const COUPLE: HeroPhoto = { src: '/images/hero/hero-couple.jpg', alt: 'Two BILD members on the dance floor at a BILD party', position: 'center 45%' }
// Four to three, so the wide desktop hero cuts roughly a quarter of its height
// away. Biased upward to keep all three riders' faces and lose road instead.
const CYCLE: HeroPhoto = { src: '/images/hero/hero-cycle.jpg', alt: 'BILD members out on a morning ride in Dubai', position: 'center 42%' }
const PARTY: HeroPhoto = { src: '/images/hero/hero-party.jpg', alt: 'BILD members celebrating together on a night out', position: 'center 48%' }
const GOLF: HeroPhoto = { src: '/images/hero/hero-golf.jpg', alt: 'BILD members at the driving range on a golf evening', position: 'center 55%' }
const SUNRISE: HeroPhoto = { src: '/images/hero/hero-sunrise.jpg', alt: 'BILD members stopped together on a sunrise ride in Dubai', position: 'center 48%' }
const GOLDEN: HeroPhoto = { src: '/images/hero/hero-golden.jpg', alt: 'BILD members dancing at a community dinner', position: 'center 45%' }

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
  BEACH, SINGER, PADEL, COUPLE, CYCLE, PARTY, GOLF, SUNRISE, GOLDEN, DANCE,
]
