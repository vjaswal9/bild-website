export interface BildEvent {
  id: string
  slug: string
  title: string
  date: string
  endDate?: string
  location: string
  venue: string
  description: string
  shortDescription: string
  imageUrl: string
  stripeLink?: string
  ticketPrice?: number
  currency: string
  status: 'upcoming' | 'past' | 'cancelled'
  tags: string[]
  isFeatured: boolean
}

export interface Business {
  id: string
  name: string
  ownerName: string
  category: string
  description: string
  contactEmail?: string
  contactPhone?: string
  website?: string
  instagram?: string
  location: string
  isVerified: boolean
  memberSince: string
  logoUrl?: string
}

export interface Photo {
  id: string
  eventSlug: string
  eventTitle: string
  src: string
  alt: string
  width: number
  height: number
  thumbnailSrc?: string
}
