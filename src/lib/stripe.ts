import Stripe from 'stripe'

// Server-side Stripe client. Never import in client components.
// Placeholder lets the build succeed without a key; the real key is injected
// from the STRIPE_SECRET_KEY env var at runtime (Vercel / .env.local).
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_placeholder_build_only')
