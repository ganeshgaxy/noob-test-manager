import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils.js'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 cursor-pointer border-none outline-none',
  {
    variants: {
      variant: {
        default: 'text-white active:scale-[0.97]',
        destructive: 'text-white active:scale-[0.97]',
        outline: 'active:scale-[0.97]',
        secondary: 'active:scale-[0.97]',
        ghost: '',
        link: 'underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  default: { background: 'var(--t-text-primary)', color: 'var(--t-bg-base)' },
  destructive: { background: 'var(--t-accent-danger)', color: '#fff' },
  outline: {
    background: 'transparent',
    border: '1px solid var(--t-border-default)',
    color: 'var(--t-text-primary)',
  },
  secondary: {
    background: 'var(--t-bg-surface)',
    color: 'var(--t-text-primary)',
    border: '1px solid var(--t-border-subtle)',
  },
  ghost: { background: 'transparent', color: 'var(--t-text-muted)', border: 'none' },
  link: { background: 'transparent', color: 'var(--t-text-primary)', border: 'none' },
}

const HOVER_STYLES: Record<string, Partial<React.CSSProperties>> = {
  default: { background: 'var(--t-text-secondary)' },
  destructive: { background: 'var(--t-accent-danger)' },
  outline: { background: 'var(--t-bg-surface)', borderColor: 'var(--t-border-strong)' },
  secondary: { background: 'var(--t-bg-panel)' },
  ghost: { background: 'var(--t-bg-surface)', color: 'var(--t-text-primary)' },
  link: {},
}

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }
>(function Button(
  {
    className,
    variant = 'default',
    size,
    asChild = false,
    style,
    onMouseEnter,
    onMouseLeave,
    ...props
  },
  ref
) {
  const Comp = asChild ? Slot : 'button'
  const v = variant ?? 'default'
  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      style={{ ...VARIANT_STYLES[v], ...style }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        const h = HOVER_STYLES[v]
        if (h.background) el.style.background = h.background
        if (h.color) el.style.color = h.color
        if ((h as any).borderColor) el.style.borderColor = (h as any).borderColor
        onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        const base = VARIANT_STYLES[v]
        el.style.background = (base.background as string) ?? ''
        el.style.color = (base.color as string) ?? ''
        el.style.borderColor = ''
        onMouseLeave?.(e)
      }}
      {...props}
    />
  )
})

export { Button, buttonVariants }
