import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  title: string
  subtitle?: string
  centered?: boolean
  className?: string
}

export default function SectionHeading({ title, subtitle, centered = true, className }: SectionHeadingProps) {
  return (
    <div className={cn('mb-12', centered && 'text-center', className)}>
      <h2 className="text-3xl md:text-4xl font-display font-bold text-charcoal-800 mb-4">{title}</h2>
      {subtitle && (
        <p className="text-lg text-charcoal-600 max-w-2xl mx-auto">{subtitle}</p>
      )}
      <div className={cn('mt-4 h-1 w-16 bg-saffron-500 rounded', centered && 'mx-auto')} />
    </div>
  )
}
