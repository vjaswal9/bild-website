import { getAllReels } from '@/lib/faces-reels-server'
import FacesAdmin from './FacesAdmin'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function AdminFacesPage() {
  const reels = await getAllReels()
  return <FacesAdmin reels={reels} />
}
