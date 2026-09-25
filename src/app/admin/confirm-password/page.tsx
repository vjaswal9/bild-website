import { Suspense } from 'react'
import ConfirmPasswordClient from './ConfirmPasswordClient'

export const dynamic = 'force-dynamic'

export default function ConfirmPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-charcoal-900" />}>
      <ConfirmPasswordClient />
    </Suspense>
  )
}
