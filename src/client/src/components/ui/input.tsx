import * as React from 'react'
import { cn } from '@/lib/utils.js'

function Input({ className, type, style, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md px-3 py-1 text-sm transition-all outline-none disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      style={{
        background: 'var(--t-bg-elevated)',
        border: '1px solid var(--t-border-default)',
        color: 'var(--t-text-primary)',
        ...style,
      }}
      onFocus={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-strong)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(128,128,128,0.15)'
      }}
      onBlur={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--t-border-default)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
      }}
      {...props}
    />
  )
}

export { Input }
