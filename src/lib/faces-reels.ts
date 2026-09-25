// Client-safe types only - do NOT import supabase-admin here.
export type FacesReel = {
  id: string
  created_at: string
  name: string
  url: string
  caption: string | null
  active: boolean
  pinned: boolean
}
