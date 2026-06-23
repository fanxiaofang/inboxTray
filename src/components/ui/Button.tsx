import { cn } from '../../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger';
  size?: 'sm' | 'md';
}

export default function Button({ 
  variant = 'default', 
  size = 'sm',
  className,
  children,
  ...props 
}: ButtonProps) {
  return (
    <button
      className={cn(
        'steampunk-button',
        variant === 'primary' && 'steampunk-button-primary',
        variant === 'danger' && 'steampunk-button-danger',
        size === 'md' && 'px-4 py-2 text-sm',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
