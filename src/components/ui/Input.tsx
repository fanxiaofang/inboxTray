import { cn } from '../../utils/cn';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn('steampunk-input', className)}
      {...props}
    />
  );
}