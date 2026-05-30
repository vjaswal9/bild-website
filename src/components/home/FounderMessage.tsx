import Image from 'next/image'

export default function FounderMessage() {
  return (
    <section className="py-20 bg-cream">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="relative">
            <div className="absolute -top-4 -left-4 w-full h-full bg-saffron-100 rounded-2xl" />
            <Image
              src="/images/truna-jaswal.jpg"
              alt="Truna Jaswal, Founder of BILD"
              width={500}
              height={600}
              className="relative rounded-2xl object-cover shadow-lg w-full"
            />
          </div>

          <div>
            <span className="text-saffron-500 font-semibold text-sm uppercase tracking-widest">A message from our Founder</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-charcoal-800 mt-4 mb-6">
              Welcome to BILD
            </h2>

            <blockquote className="space-y-4 text-charcoal-600 leading-relaxed">
              <p>
                &ldquo;Hello, I&apos;m Truna, the Founder of BILD. What started as a simple idea, bringing people
                together so no one ever feels alone in a new city, has grown into a warm, close-knit community that
                feels like family.&rdquo;
              </p>
              <p>
                &ldquo;BILD is all about belonging. We laugh together, support each other, celebrate our cultures,
                and create moments that feel special.&rdquo;
              </p>
              <p className="text-charcoal-700 font-medium">
                &ldquo;BILD is built with heart. It is a community where kindness leads, friendships grow naturally,
                and everyone is genuinely welcomed.&rdquo;
              </p>
              <p>
                &ldquo;This is a space where anyone who connects with our British Indian spirit can feel at home,
                whether you have lived in Dubai for years or have just arrived.&rdquo;
              </p>
              <p className="text-saffron-600 font-semibold font-display text-lg">
                &ldquo;Welcome to BILD. Your people, your place, your Dubai family.&rdquo;
              </p>
            </blockquote>

            <div className="mt-8 flex items-center gap-4">
              <div className="w-10 h-0.5 bg-gold-500 rounded-full shrink-0" />
              <div>
                <p className="font-display font-bold text-charcoal-800 text-lg">Truna Jaswal</p>
                <p className="text-sm text-charcoal-500">Founder, BILD</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
