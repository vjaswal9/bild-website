'use client'

export default function ScrollToFormButton() {
  return (
    <button
      onClick={() => document.getElementById('application')?.scrollIntoView({ behavior: 'smooth' })}
      className="block w-full bg-gold-500 text-white text-center py-4 rounded-xl font-semibold text-lg hover:bg-gold-600 transition-all hover:shadow-lg"
    >
      Start your application
    </button>
  )
}
