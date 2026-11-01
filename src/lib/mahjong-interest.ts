// The Mahjong interest form: the choices it offers, shared by the form in the
// browser and the route that saves it, so the two cannot drift apart. The route
// accepts only these values; anything else a script posts is thrown away.

export const MAHJONG_MEMBER_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'joining', label: 'No, I would like information about joining' },
  { value: 'unsure', label: 'Not sure' },
] as const

export const MAHJONG_AREAS = [
  'Arabian Ranches / Motor City / Dubai Hills',
  'Marina / JLT / JBR',
  'Al Furjan / Jebel Ali',
  'Jumeirah / Umm Suqeim / Al Barsha',
  'Downtown / Business Bay',
  'Flexible / other (please add below)',
] as const

export const MAHJONG_EXPERIENCE_OPTIONS = [
  { value: 'beginner', label: 'Complete beginner: I would like to learn' },
  { value: 'refresher', label: 'I have tried it and would like a refresher' },
  { value: 'player', label: 'I can play and would like to join socials' },
] as const

export const MAHJONG_TIMES = [
  'Weekday mornings',
  'Weekday afternoons',
  'Weekday evenings',
  'Weekend mornings',
  'Weekend afternoons',
  'Weekend evenings',
] as const

export const MAHJONG_NOTES_MAX = 500

export const mahjongLabel = (
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
) => options.find(o => o.value === value)?.label ?? (value || '')
