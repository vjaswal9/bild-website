import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { GalleryItem } from '@/lib/events'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

function authed(req: NextRequest) {
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)
}

async function getGallery(eventId: string): Promise<GalleryItem[]> {
  const { data } = await supabaseAdmin.from('events').select('gallery').eq('id', eventId).maybeSingle()
  return ((data as { gallery?: GalleryItem[] })?.gallery) || []
}

// Append a media item (photo/video) to an event gallery.
export async function POST(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { event_id, url, type } = await req.json().catch(() => ({}))
  if (!event_id || !url) return NextResponse.json({ error: 'Missing event_id or url' }, { status: 400 })

  const gallery = await getGallery(event_id)
  gallery.push({ url, type: type === 'video' ? 'video' : type === 'instagram' ? 'instagram' : 'image' })
  const { error } = await supabaseAdmin.from('events').update({ gallery }).eq('id', event_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, gallery })
}

// Remove a media item by url.
export async function DELETE(req: NextRequest) {
  if (!(await authed(req))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { event_id, url } = await req.json().catch(() => ({}))
  if (!event_id || !url) return NextResponse.json({ error: 'Missing event_id or url' }, { status: 400 })

  const gallery = (await getGallery(event_id)).filter(g => g.url !== url)
  const { error } = await supabaseAdmin.from('events').update({ gallery }).eq('id', event_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, gallery })
}
