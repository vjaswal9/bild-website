import { supabaseAdmin } from '@/lib/supabase-admin'
import { Testimonial } from '@/lib/testimonials'
import TestimonialsAdmin from './TestimonialsAdmin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AdminTestimonialsPage() {
  const { data } = await supabaseAdmin
    .from('testimonials')
    .select('*')
    .order('created_at', { ascending: false })

  const testimonials = (data || []) as Testimonial[]

  // Reviews left against a directory business carry a business_id; look up the
  // names so the moderation cards can show what each review is actually about.
  const businessIds = Array.from(new Set(testimonials.map(t => t.business_id).filter(Boolean))) as string[]
  const { data: bizRows } = businessIds.length
    ? await supabaseAdmin.from('business_submissions').select('id, business_name, slug').in('id', businessIds)
    : { data: [] }
  const businessNames: Record<string, { name: string; slug: string | null }> = {}
  ;(bizRows || []).forEach(b => { businessNames[b.id] = { name: b.business_name, slug: b.slug } })

  return <TestimonialsAdmin testimonials={testimonials} businessNames={businessNames} />
}
