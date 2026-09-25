import { supabaseRead } from './supabase-admin'

export type Milestone = {
  id: string
  year_label: string
  title: string
  body: string
  sort_order: number
  published: boolean
}

// Read through the cacheable client so /about stays prerendered. Admin edits
// call revalidatePath('/about'), so a change is live immediately anyway.
export async function getPublishedMilestones(): Promise<Milestone[]> {
  const { data } = await supabaseRead
    .from('milestones')
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true })
  return (data as Milestone[]) || []
}
