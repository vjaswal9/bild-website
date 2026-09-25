'use client'

import { useEffect, useState } from 'react'
import GoogleRatingBadge from './GoogleRatingBadge'

type Rating = { rating: number; totalReviews: number; mapsUrl: string }

export default function GoogleRatingBadgeClient() {
  const [data, setData] = useState<Rating | null>(null)

  useEffect(() => {
    fetch('/api/google-rating')
      .then(res => res.json())
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data) return null
  return <GoogleRatingBadge rating={data.rating} totalReviews={data.totalReviews} mapsUrl={data.mapsUrl} />
}
