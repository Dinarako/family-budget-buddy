import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface PasswordInputProps extends React.ComponentProps<'input'> {}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          className={cn('pr-10', className)}
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          disabled={disabled}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className={cn(
            'absolute right-0 top-0 h-10 w-10',
            'flex items-center justify-center',
            'text-muted-foreground transition-colors',
            'hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
          tabIndex={disabled ? -1 : 0}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
