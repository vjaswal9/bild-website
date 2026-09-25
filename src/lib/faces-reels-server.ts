// Server-only: imports the service-role Supabase client. Never import this
// file from a client component (it would leak the secret key into the bundle).
import { supabaseAdmin, supabaseRead } from './supabase-admin'
import type { FacesReel } from './faces-reels'

// Read through the cacheable client. This is the public Faces of BILD list,
// identical for every visitor, and using the no-store client forced the whole
// page to render per request, which also meant a live Google Places call on
// every visit. getAllReels below stays on the no-store client because it is
// the admin view, where stale data would be confusing.
export async function getActiveReels(): Promise<FacesReel[]> {
  const { data } = await supabaseRead
    .from('faces_reels')
    .select('*')
    .eq('active', true)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  return (data as FacesReel[]) || []
}

export async function getAllReels(): Promise<FacesReel[]> {
  const { data } = await supabaseAdmin
    .from('faces_reels')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  return (data as FacesReel[]) || []
}
