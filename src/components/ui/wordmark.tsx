interface WordmarkProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses: Record<NonNullable<WordmarkProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-3xl',
}

export function Wordmark({ size = 'md', className }: WordmarkProps): React.JSX.Element {
  return (
    <span className={`font-mono ${sizeClasses[size]}${className ? ` ${className}` : ''}`}>
      <span className="font-normal text-gray-400">web</span>
      <span className="font-semibold text-accent">snag</span>
    </span>
  )
}
