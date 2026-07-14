/**
 * UserAvatar — reusable avatar component.
 * Shows the user's avatar_url image if present, otherwise a
 * coloured circle with the first letter of nickname / username.
 */
import type { User } from '../types';

interface UserAvatarProps {
  user: Pick<User, 'username'> & { nickname?: string | null; avatar_url?: string | null };
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
};

export function UserAvatar({ user, size = 'md', className = '' }: UserAvatarProps) {
  const displayName = user.nickname?.trim() || user.username;
  const initial = displayName.charAt(0).toUpperCase();
  const sizeClass = SIZE_CLASSES[size];

  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={displayName}
        className={`${sizeClass} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 font-semibold shrink-0 ${className}`}
    >
      {initial}
    </div>
  );
}
