'use client'

import { useState, useRef, useEffect } from 'react'
import { uploadViaSignedUrl } from '@/lib/upload-client'
import { CheckCircle, ArrowLeft, FileText, X, ImagePlus } from 'lucide-react'
import Link from 'next/link'
import PageHero from '@/components/ui/PageHero'
import GoogleRatingBadgeClient from '@/components/ui/GoogleRatingBadgeClient'
import LeadCapture from '@/components/directory/LeadCapture'
import { compressImage } from '@/lib/compress-image'
import { normaliseInstagramHandle } from '@/lib/instagram'
import { normalizeWebsiteUrl } from '@/lib/utils'
import { getImageDimensions, squareWarning } from '@/lib/image-dimensions'
import { LISTING_MEMBER_FEE_AED, LISTING_NON_MEMBER_FEE_AED, LISTING_GRACE_LABEL } from '@/lib/featured-copy'

const CATEGORIES = [
  'Financial Services', 'Insurance', 'Beauty', 'Residency Services', 'Marketing',
  'Consultancy & Advisory', 'Recruitment', 'Motors', 'Health & Wellbeing',
  'Fitness & Sports', 'Property', 'Real Estate Brokerage', 'Jewellery', 'Legal',
  'Food & Catering', 'Restaurants', 'Manufacturing', 'Technology', 'Education & Tutoring',
  'Photography & Videography', 'Home Services & Trades', 'Travel & Tourism', 'Accommodation',
  'Retail & Fashion', 'Professional Services', 'Arts & Entertainment', 'Other',
]

const MAX_DESCRIPTION_WORDS = 150

function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

// Enforce the word cap by truncating any overflow, so typing never silently
// loses characters mid-word - it just stops accepting new words.
function capWords(text: string, maxWords: number): string {
  const words = text.split(/(\s+)/) // keep whitespace tokens so spacing is preserved
  let count = 0
  let out = ''
  for (const token of words) {
    if (/^\s+$/.test(token)) { out += token; continue }
    if (token === '') continue
    if (count >= maxWords) break
    out += token
    count += 1
  }
  return out
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

const inputBase = 'w-full px-4 py-2.5 border rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400'
const errBorder = 'border-ruby-500 ring-1 ring-ruby-300'
const okBorder = 'border-gold-200'

export default function SubmitBusinessPage() {
  const [submitted, setSubmitted] = useState(false)
  const successRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (submitted) successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [submitted])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [tried, setTried] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const [businessName, setBusinessName] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [documentExpiryDate, setDocumentExpiryDate] = useState('')
  const [memberConfirm, setMemberConfirm] = useState(false)

  const [businessCountry, setBusinessCountry] = useState<'UAE' | 'UK'>('UAE')
  const [isBildMember, setIsBildMember] = useState<boolean | null>(null)
  const [bildOffer, setBildOffer] = useState('')
  const [hasGoogleReviews, setHasGoogleReviews] = useState<boolean | null>(null)
  const [licenseFile, setLicenseFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')
  const [logoWarning, setLogoWarning] = useState<string>('')
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [instagramInput, setInstagramInput] = useState('')
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string>('')
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const [description, setDescription] = useState('')

  function cls(filled: boolean) {
    return `${inputBase} ${tried && !filled ? errBorder : okBorder}`
  }

  function findMissing(): boolean {
    return !businessName.trim() || !category || !description.trim() || !location.trim() ||
      !ownerName.trim() || !phone.trim() || !isEmail(email) || isBildMember === null ||
      !licenseFile || !documentExpiryDate || !memberConfirm ||
      (isBildMember === false && !bildOffer.trim())
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setTried(true)

    if (findMissing()) {
      setError('Please complete the highlighted fields above.')
      // setTimeout rather than requestAnimationFrame: rAF is throttled/paused
      // for backgrounded or non-foreground tabs, which would silently drop
      // this scroll for anyone not actively focused on the tab at that instant.
      setTimeout(() => {
        const firstInvalid = formRef.current?.querySelector('.border-ruby-500, [data-invalid="true"]')
        if (firstInvalid) firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 0)
      return
    }

    setSubmitting(true)
    setError('')

    const form = e.currentTarget
    const fd = new FormData(form)

    // Upload business document (UAE trade licence or UK registration evidence) to Supabase Storage
    let documentUrl: string | null = null
    if (licenseFile) {
      try {
        const up = await uploadViaSignedUrl({
          kind: 'business-licence',
          file: licenseFile,
          contentType: 'application/pdf',
        })
        documentUrl = up.path
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload your document. Please try again.')
        setSubmitting(false)
        return
      }
    }

    // Upload logo image to the public business-logos bucket (shown on the card)
    let logoUrl: string | null = normalizeWebsiteUrl(fd.get('logo_url') as string)
    if (logoFile) {
      try {
        const logo = await compressImage(logoFile, 800)
        const up = await uploadViaSignedUrl({ kind: 'business-logo', file: logo })
        logoUrl = up.publicUrl
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload logo. Please try a different image or paste a link instead.')
        setSubmitting(false)
        return
      }
    }

    // Optional wide hero image shown across the top of the profile page.
    let bannerUrl: string | null = null
    if (bannerFile) {
      try {
        const banner = await compressImage(bannerFile, 1600)
        const up = await uploadViaSignedUrl({ kind: 'business-banner', file: banner })
        bannerUrl = up.publicUrl
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload banner image. Please try a different image.')
        setSubmitting(false)
        return
      }
    }

    const payload = {
      business_name: businessName.trim(),
      category,
      tagline: (fd.get('tagline') as string) || null,
      description: description.trim(),
      location: location.trim(),
      owner_name: ownerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      website: normalizeWebsiteUrl(fd.get('website') as string),
      instagram: normaliseInstagramHandle(fd.get('instagram') as string),
      linkedin: normalizeWebsiteUrl(fd.get('linkedin') as string),
      google_maps_url: hasGoogleReviews ? (fd.get('google_maps_url') as string) || null : null,
      logo_url: logoUrl,
      banner_url: bannerUrl,
      established_year: (fd.get('established_year') as string) || null,
      bild_member_since: (fd.get('bild_member_since') as string) || null,
      bild_offer: bildOffer.trim() || null,
      extra_info: (fd.get('extra_info') as string) || null,
      business_country: businessCountry,
      is_bild_member: isBildMember,
      document_url: documentUrl,
      document_expiry_date: documentExpiryDate || null,
    }

    const res = await fetch('/api/business/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      setError('Something went wrong. Please try again or email us at connect@bild.ae')
    } else {
      setSubmitted(true)
    }
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <>
        <PageHero title="List Your Business" subtitle="Join the BILD Business Directory">
          <GoogleRatingBadgeClient />
        </PageHero>
        <div className="py-20 max-w-xl mx-auto px-4 text-center">
          <div ref={successRef} className="w-20 h-20 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-gold-500" />
          </div>
          <h2 className="font-display text-3xl font-bold text-charcoal-800 mb-4">Submission received!</h2>
          <p className="text-charcoal-600 mb-2">
            Thank you for submitting your business. Our team will review your listing and you will hear back within 48 hours.
          </p>
          <p className="text-charcoal-400 text-sm mb-8">Once approved, your business will appear in the BILD directory.</p>
          <Link href="/directory" className="inline-block bg-gold-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gold-600 transition-colors">
            Back to Directory
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHero title="List Your Business" subtitle="Join the BILD Business Directory">
        <GoogleRatingBadgeClient />
      </PageHero>
      <div className="py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/directory" className="inline-flex items-center gap-2 text-charcoal-600 hover:text-gold-600 mb-8 text-sm font-medium">
            <ArrowLeft size={16} /> Back to Directory
          </Link>

          <div className="bg-gold-50 border border-gold-200 rounded-2xl p-4 mb-4 text-sm text-charcoal-600">
            <strong className="text-charcoal-800">Open to BILD members and non-members alike.</strong> BILD members list
            for {LISTING_MEMBER_FEE_AED} AED/year (free until {LISTING_GRACE_LABEL}); non-BILD businesses list for {LISTING_NON_MEMBER_FEE_AED} AED/year.
            Payment is only requested after your listing is approved.
          </div>

          <div className="bg-cream border border-gold-200 rounded-2xl p-4 mb-4 text-sm text-charcoal-600">
            <strong className="text-charcoal-800">Submitting is free.</strong> Once approved, BILD members pay {LISTING_MEMBER_FEE_AED} AED/year
            (free until {LISTING_GRACE_LABEL}); non-BILD businesses pay {LISTING_NON_MEMBER_FEE_AED} AED/year from approval.
          </div>

          <div className="bg-cream border border-charcoal-200 rounded-2xl p-4 mb-8 text-sm text-charcoal-600">
            <strong className="text-charcoal-800">A valid business registration document is required.</strong> Both
            UAE-licensed and UK-registered businesses may be listed - select which applies to you below and upload
            the relevant document. If your business operates in a regulated sector (for example financial services,
            insurance, real estate brokerage, legal or healthcare), you must also hold the relevant regulatory
            approval, and remain responsible for ensuring your listing complies with applicable advertising rules.
          </div>

          <LeadCapture formRef={formRef} done={submitted} />
          <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6">

            {/* Contact Info */}
            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Contact Details</legend>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Your Name <span className="text-ruby-500">*</span></label>
                  <input name="owner_name" type="text" placeholder="Full name"
                    value={ownerName} onChange={e => setOwnerName(e.target.value)}
                    className={cls(!!ownerName.trim())} />
                  {tried && !ownerName.trim() && <p className="text-xs text-ruby-500 mt-1">This field is required.</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Contact Number <span className="text-ruby-500">*</span></label>
                  <input name="phone" type="tel" placeholder="+971 50 123 4567"
                    value={phone} onChange={e => setPhone(e.target.value)}
                    className={cls(!!phone.trim())} />
                  {tried && !phone.trim() && <p className="text-xs text-ruby-500 mt-1">This field is required.</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Business Email <span className="text-ruby-500">*</span></label>
                <input name="email" type="email" placeholder="hello@yourbusiness.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className={cls(isEmail(email))} />
                {tried && !isEmail(email) && <p className="text-xs text-ruby-500 mt-1">{email.trim() ? 'Please enter a valid email address.' : 'This field is required.'}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Website</label>
                <input name="website" type="text" placeholder="www.yourbusiness.com"
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                <p className="text-xs text-charcoal-400 mt-1">https:// is optional, we&rsquo;ll add it automatically.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Instagram Handle</label>
                <div className="flex items-center">
                  <span className="px-3 py-2.5 bg-gold-100 border border-r-0 border-gold-200 rounded-l-xl text-charcoal-500 text-sm">@</span>
                  <input name="instagram" type="text" placeholder="yourbusiness"
                    value={instagramInput}
                    onChange={e => setInstagramInput(e.target.value)}
                    className="flex-1 px-4 py-2.5 border border-gold-200 rounded-r-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                </div>
                {/* Tells people exactly what will be saved, so pasting a full
                    profile URL is self-correcting rather than silently wrong. */}
                {(() => {
                  const typed = instagramInput.trim()
                  if (!typed) {
                    return <p className="text-xs text-charcoal-400 mt-1.5">Just the handle, not the full link. For example <strong>yourbusiness</strong>, not https://instagram.com/yourbusiness</p>
                  }
                  const handle = normaliseInstagramHandle(typed)
                  if (!handle) {
                    return <p className="text-xs text-ruby-500 mt-1.5">That does not look like an Instagram handle. Enter just your handle, for example <strong>yourbusiness</strong>.</p>
                  }
                  if (handle !== typed.replace(/^@/, '')) {
                    return <p className="text-xs text-green-600 mt-1.5">We&rsquo;ll save this as <strong>@{handle}</strong></p>
                  }
                  return <p className="text-xs text-green-600 mt-1.5">Looks good: <strong>@{handle}</strong></p>
                })()}
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">LinkedIn Page</label>
                <input name="linkedin" type="text" placeholder="linkedin.com/company/yourbusiness"
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                <p className="text-xs text-charcoal-400 mt-1">Optional. https:// is optional too, we&rsquo;ll add it automatically.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Do you have Google reviews you&apos;d like to display?</label>
                <p className="text-xs text-charcoal-500 mb-2">
                  Showing your Google rating builds trust with potential customers browsing the directory, boosts click-throughs to your profile, and gives your listing a visible edge over businesses without reviews.
                </p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setHasGoogleReviews(true)}
                    className={`flex-1 px-4 py-2.5 rounded-xl border-2 font-medium transition-colors ${
                      hasGoogleReviews === true ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-charcoal-700 border-gold-200 hover:border-gold-300'
                    }`}>Yes</button>
                  <button type="button" onClick={() => setHasGoogleReviews(false)}
                    className={`flex-1 px-4 py-2.5 rounded-xl border-2 font-medium transition-colors ${
                      hasGoogleReviews === false ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-charcoal-700 border-gold-200 hover:border-gold-300'
                    }`}>No</button>
                </div>
                {hasGoogleReviews && (
                  <div className="mt-3">
                    <input name="google_maps_url" type="text" placeholder="g.page/r/.../review"
                      className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                    <p className="text-xs text-charcoal-400 mt-1">
                      From your Google Business Profile: Home → &ldquo;Get more reviews&rdquo; → copy the link shown there.
                      This is the link that lets us pull your star rating and reviews onto your listing.
                    </p>
                  </div>
                )}
              </div>
            </fieldset>

            {/* Business Info */}
            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Business Information</legend>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Business Name <span className="text-ruby-500">*</span></label>
                <input name="business_name" type="text" placeholder="e.g. Spice Route Catering"
                  value={businessName} onChange={e => setBusinessName(e.target.value)}
                  className={cls(!!businessName.trim())} />
                {tried && !businessName.trim() && <p className="text-xs text-ruby-500 mt-1">This field is required.</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Category <span className="text-ruby-500">*</span></label>
                <select name="category" value={category} onChange={e => setCategory(e.target.value)}
                  className={cls(!!category)}>
                  <option value="">Select a category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {tried && !category && <p className="text-xs text-ruby-500 mt-1">Please select a category.</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Tagline</label>
                <input name="tagline" type="text" maxLength={70} placeholder="e.g. Authentic British-Indian fusion catering"
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                <p className="text-xs text-charcoal-400 mt-1">A short one-line hook shown under your business name (max 70 characters).</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Business Description <span className="text-ruby-500">*</span></label>
                <textarea name="description" rows={4} placeholder="Tell us what your business does and what makes it special..."
                  value={description}
                  onChange={e => setDescription(capWords(e.target.value, MAX_DESCRIPTION_WORDS))}
                  className={`${cls(!!description.trim())} resize-none`} />
                <div className="flex items-center justify-between mt-1">
                  {tried && !description.trim() ? <p className="text-xs text-ruby-500">This field is required.</p> : <span />}
                  <p className={`text-xs text-right ${countWords(description) >= MAX_DESCRIPTION_WORDS ? 'text-amber-600 font-medium' : 'text-charcoal-400'}`}>
                    {countWords(description)} / {MAX_DESCRIPTION_WORDS} words
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Location / Area <span className="text-ruby-500">*</span></label>
                <input name="location" type="text" placeholder="e.g. Dubai Marina, Abu Dhabi, Online"
                  value={location} onChange={e => setLocation(e.target.value)}
                  className={cls(!!location.trim())} />
                {tried && !location.trim() && <p className="text-xs text-ruby-500 mt-1">This field is required.</p>}
              </div>

              <div data-invalid={tried && isBildMember === null ? 'true' : undefined}>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Are you a BILD member? <span className="text-ruby-500">*</span></label>
                <div className={`flex gap-3 rounded-xl ${tried && isBildMember === null ? 'ring-2 ring-ruby-300 ring-offset-2' : ''}`}>
                  <button type="button" onClick={() => setIsBildMember(true)}
                    className={`flex-1 px-4 py-2.5 rounded-xl border-2 font-medium transition-colors ${
                      isBildMember === true ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-charcoal-700 border-gold-200 hover:border-gold-300'
                    }`}>Yes, I&apos;m a BILD member</button>
                  <button type="button" onClick={() => setIsBildMember(false)}
                    className={`flex-1 px-4 py-2.5 rounded-xl border-2 font-medium transition-colors ${
                      isBildMember === false ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-charcoal-700 border-gold-200 hover:border-gold-300'
                    }`}>No, I&apos;m not a member</button>
                </div>
                {tried && isBildMember === null && <p className="text-xs text-ruby-500 mt-1">Please select one.</p>}
                <p className="text-xs text-charcoal-400 mt-1">
                  BILD members list for {LISTING_MEMBER_FEE_AED} AED/year; non-BILD businesses list for {LISTING_NON_MEMBER_FEE_AED} AED/year.
                </p>
                {isBildMember === false && (
                  <div className="mt-3 bg-gold-50 border border-gold-200 rounded-xl p-4 text-sm text-charcoal-600 space-y-2">
                    <p>
                      Put your business in front of a community of 2,000+ members. As an external business, you&apos;ll get your own profile featuring your business details, Google reviews, website, social media, and contact information.
                    </p>
                    <p>
                      <span className="font-semibold text-charcoal-700">What we ask in return:</span> Offer BILD members an exclusive benefit - whether a discount, special offer, complimentary service, or other valued perk - to create a genuine, mutually beneficial partnership.
                    </p>
                  </div>
                )}
              </div>
            </fieldset>

            {/* Logo */}
            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Business Logo</legend>
              <p className="text-sm text-charcoal-500">
                <strong className="text-charcoal-700">What this is:</strong> your business logo or brand mark. It appears as the small
                square image on your listing in the directory, and larger at the top of your own profile page. This is how most people
                will recognise you when browsing.
              </p>
              <p className="text-xs text-charcoal-500 bg-white border border-gold-200 rounded-lg px-3 py-2">
                <strong className="text-charcoal-700">Recommended size:</strong> square, <strong>500 x 500 pixels</strong> or larger (up to 1000 x 1000).
                PNG or JPG, max 3MB. A square image is important - non-square logos get trimmed on the directory cards.
              </p>
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-xl border border-gold-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {logoPreview
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                    : <ImagePlus size={26} className="text-gold-300" />}
                </div>
                <div className="flex-1">
                  {!logoFile ? (
                    <label className="inline-flex items-center gap-2 bg-white border border-gold-300 text-charcoal-700 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:bg-gold-50 transition-colors">
                      <ImagePlus size={16} /> Choose logo image
                      <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                        onChange={async e => {
                          const f = e.target.files?.[0] || null
                          setLogoFile(f)
                          setLogoPreview(f ? URL.createObjectURL(f) : '')
                          setLogoWarning('')
                          if (f) {
                            try {
                              const { width, height } = await getImageDimensions(f)
                              const w = squareWarning(width, height)
                              if (w) setLogoWarning(w)
                            } catch { /* ignore - not critical */ }
                          }
                        }} />
                    </label>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-charcoal-700 truncate max-w-[180px]">{logoFile.name}</span>
                      <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(''); setLogoWarning(''); if (logoInputRef.current) logoInputRef.current.value = '' }}
                        className="text-charcoal-400 hover:text-ruby-500"><X size={16} /></button>
                    </div>
                  )}
                  {logoWarning && <p className="text-xs text-amber-600 mt-2">{logoWarning}</p>}
                  <p className="text-xs text-charcoal-400 mt-2">Or paste a link instead:</p>
                  <input name="logo_url" type="text" placeholder="link-to-your-logo.com/logo.png"
                    className="w-full mt-1 px-3 py-2 border border-gold-200 rounded-lg bg-white text-charcoal-800 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400" />
                </div>
              </div>
            </fieldset>

            {/* Banner */}
            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Banner Image <span className="text-charcoal-400 text-sm font-normal">(optional)</span></legend>
              <p className="text-sm text-charcoal-500">
                <strong className="text-charcoal-700">What this is:</strong> a wide photograph displayed like a header across the very top
                of your profile page, above your logo and name. It sets the tone before anyone reads a word. A team photo, your shop or
                office, or an example of your work all work well. This is not your logo.
              </p>
              <p className="text-xs text-charcoal-500 bg-white border border-gold-200 rounded-lg px-3 py-2">
                <strong className="text-charcoal-700">Recommended size:</strong> wide landscape, <strong>1600 x 400 pixels</strong> (a 4:1 shape). JPG or PNG, max 5MB.
                Keep faces and any text near the middle - the top, bottom and edges are trimmed to fit different screen sizes.
              </p>
              <div className="flex items-center gap-5">
                <div className="w-32 h-12 rounded-lg border border-gold-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {bannerPreview
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={bannerPreview} alt="Banner preview" className="w-full h-full object-cover" />
                    : <ImagePlus size={22} className="text-gold-300" />}
                </div>
                <div className="flex-1">
                  {!bannerFile ? (
                    <label className="inline-flex items-center gap-2 bg-white border border-gold-300 text-charcoal-700 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:bg-gold-50 transition-colors">
                      <ImagePlus size={16} /> Choose banner image
                      <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0] || null
                          setBannerFile(f)
                          setBannerPreview(f ? URL.createObjectURL(f) : '')
                        }} />
                    </label>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-charcoal-700 truncate max-w-[180px]">{bannerFile.name}</span>
                      <button type="button" onClick={() => { setBannerFile(null); setBannerPreview(''); if (bannerInputRef.current) bannerInputRef.current.value = '' }}
                        className="text-charcoal-400 hover:text-ruby-500"><X size={16} /></button>
                    </div>
                  )}
                  <p className="text-xs text-charcoal-400 mt-2">Leave this empty and your profile simply starts with your logo and name.</p>
                </div>
              </div>
            </fieldset>

            {/* Business Registration */}
            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-4">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Business Registration <span className="text-ruby-500">*</span></legend>
              <p className="text-sm text-charcoal-500">Is your business registered in the UAE or the UK?</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setBusinessCountry('UAE')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                    businessCountry === 'UAE' ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-charcoal-700 border-gold-200 hover:border-gold-300'
                  }`}
                >
                  🇦🇪 UAE
                </button>
                <button
                  type="button"
                  onClick={() => setBusinessCountry('UK')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                    businessCountry === 'UK' ? 'bg-gold-500 text-white border-gold-500' : 'bg-white text-charcoal-700 border-gold-200 hover:border-gold-300'
                  }`}
                >
                  🇬🇧 UK
                </button>
              </div>

              {businessCountry === 'UK' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-charcoal-700">
                  <strong>Please note:</strong> UK-registered businesses listed in the BILD directory may only
                  transact for services delivered in the UK (for example, services carried out or provided within
                  the UK) - not for services provided within the UAE. This will also be shown on your public listing.
                </div>
              )}

              <p className="text-sm text-charcoal-500">
                {businessCountry === 'UAE'
                  ? 'Please upload a copy of your valid UAE trade licence or business licence. This is required for verification and will only be seen by the BILD admin team. It will never be shared publicly.'
                  : 'Please upload evidence of your UK business registration (for example, a Companies House registration certificate). This is required for verification and will only be seen by the BILD admin team. It will never be shared publicly.'}
              </p>

              {!licenseFile ? (
                <label
                  data-invalid={tried && !licenseFile ? 'true' : undefined}
                  className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer bg-white hover:bg-gold-50 transition-colors ${
                    tried && !licenseFile ? 'border-ruby-500' : 'border-gold-300'
                  }`}
                >
                  <FileText size={32} className={tried && !licenseFile ? 'text-ruby-400 mb-2' : 'text-gold-400 mb-2'} />
                  <span className="text-sm font-medium text-charcoal-600">
                    {businessCountry === 'UAE' ? 'Click to upload your business licence' : 'Click to upload your registration evidence'}
                  </span>
                  <span className="text-xs text-charcoal-400 mt-1">PDF only, max 10MB</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={e => setLicenseFile(e.target.files?.[0] || null)}
                  />
                </label>
              ) : (
                <div className="flex items-center gap-3 bg-gold-50 border border-gold-200 rounded-xl px-4 py-3">
                  <FileText size={24} className="text-gold-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal-800 truncate">{licenseFile.name}</p>
                    <p className="text-xs text-charcoal-400">{(licenseFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setLicenseFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    className="text-charcoal-400 hover:text-red-500 transition-colors"
                    aria-label="Remove file"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
              {tried && !licenseFile && <p className="text-xs text-ruby-500">Please upload your document.</p>}

              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1.5">
                  {businessCountry === 'UAE' ? 'Licence expiry date' : 'Document expiry date'} <span className="text-ruby-500">*</span>
                </label>
                <input
                  name="document_expiry_date"
                  type="date"
                  value={documentExpiryDate}
                  onChange={e => setDocumentExpiryDate(e.target.value)}
                  className={`px-3 py-2 text-sm ${cls(!!documentExpiryDate)}`}
                />
                {tried && !documentExpiryDate && <p className="text-xs text-ruby-500 mt-1">This field is required.</p>}
                <p className="text-xs text-charcoal-400 mt-1.5">
                  We&rsquo;ll email you a reminder before this date so you can upload a renewed document and keep your listing active.
                </p>
              </div>

              <p className="text-xs text-charcoal-400 border-t border-gold-200 pt-3">
                Your documents are handled securely and in line with applicable UAE data protection requirements.
              </p>
            </fieldset>

            {/* Extra */}
            <fieldset className="bg-cream border border-gold-200 rounded-2xl p-6 space-y-5">
              <legend className="font-display font-bold text-charcoal-800 text-lg px-1">Additional Information</legend>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Year Established</label>
                <input name="established_year" type="number" min="1900" max="2099" placeholder="e.g. 2018"
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                <p className="text-xs text-charcoal-400 mt-1">The year your business started trading. Shown as &ldquo;Trading since 2018&rdquo;.</p>
              </div>

              {isBildMember !== false && (
                <div>
                  <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">BILD Member Since</label>
                  <input name="bild_member_since" type="number" min="2019" max={new Date().getFullYear()} placeholder="e.g. 2022"
                    className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400" />
                  <p className="text-xs text-charcoal-400 mt-1">When you personally joined BILD (not when your business started). Shown on your listing as &ldquo;BILD member since&rdquo;.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">
                  Special Offer for BILD Members {isBildMember === false && <span className="text-ruby-500">*</span>}
                </label>
                <input name="bild_offer" type="text" placeholder="e.g. 10% discount for BILD members"
                  value={bildOffer} onChange={e => setBildOffer(e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400 ${
                    tried && isBildMember === false && !bildOffer.trim() ? errBorder : 'border-gold-200'
                  }`} />
                {tried && isBildMember === false && !bildOffer.trim() && (
                  <p className="text-xs text-ruby-500 mt-1">This field is required.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-700 mb-1.5">Anything else you&apos;d like to add?</label>
                <textarea name="extra_info" rows={3} placeholder="Awards, certifications, languages spoken, notable clients, etc."
                  className="w-full px-4 py-2.5 border border-gold-200 rounded-xl bg-white text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-gold-400 resize-none" />
              </div>

              <div>
                <div className={`flex items-start gap-3 rounded-lg ${tried && !memberConfirm ? 'ring-1 ring-ruby-300' : ''}`}>
                  <input id="member_confirm" name="member_confirm" type="checkbox"
                    checked={memberConfirm} onChange={e => setMemberConfirm(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-gold-500" />
                  <label htmlFor="member_confirm" className="text-sm text-charcoal-600">
                    I confirm that the information provided is accurate, and the business document uploaded is valid. <span className="text-ruby-500">*</span>
                  </label>
                </div>
                {tried && !memberConfirm && <p className="text-xs text-ruby-500 mt-1">Please confirm before submitting.</p>}
              </div>
            </fieldset>

            {error && <p className="text-red-500 text-sm text-center bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gold-500 text-white py-4 rounded-xl font-semibold text-lg hover:bg-gold-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Uploading & Submitting...' : 'Submit My Business'}
            </button>

            <p className="text-xs text-center text-charcoal-400">
              Your submission will be reviewed within 48 hours. By submitting, you agree to our{' '}
              <Link href="/community-rules" className="text-gold-600 hover:underline">community rules</Link>.
            </p>
            {/* Said plainly, because it is true and because the privacy policy
                already commits to it. Hiding it would be the wrong call on a
                form this long. */}
            <p className="text-xs text-center text-charcoal-400">
              Once you have entered your email we save your answers as you go, so you can come back and finish
              later and so we can help if you get stuck. See our{' '}
              <Link href="/privacy" className="text-gold-600 hover:underline">privacy policy</Link>.
            </p>
          </form>
        </div>
      </div>
    </>
  )
}
