import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
          {
            'bg-saffron-500 text-white hover:bg-saffron-600 focus:ring-saffron-500 shadow-sm hover:shadow':
              variant === 'primary',
            'bg-charcoal-700 text-white hover:bg-charcoal-800 focus:ring-charcoal-700 shadow-sm':
              variant === 'secondary',
            'border-2 border-charcoal-700 text-charcoal-700 hover:bg-charcoal-700 hover:text-white focus:ring-charcoal-700':
              variant === 'outline',
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-5 py-2.5 text-base': size === 'md',
            'px-8 py-3.5 text-lg': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
export default Button
