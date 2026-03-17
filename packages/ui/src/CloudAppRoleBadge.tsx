import React from 'react';
import {
  formatCloudAppRoleLabel,
  isCloudAppAdmin,
  normalizeCloudAppRoles,
} from '@portfolio/auth';

type CloudAppRoleBadgeProps = {
  roles?: string[];
  isAdmin?: boolean;
  className?: string;
  variant?: 'accent' | 'subtle';
};

const joinClasses = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' ');

const VARIANT_CLASSES: Record<NonNullable<CloudAppRoleBadgeProps['variant']>, string> = {
  accent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800',
  subtle: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700',
};

export function CloudAppRoleBadge({
  roles = [],
  isAdmin,
  className,
  variant = 'accent',
}: CloudAppRoleBadgeProps) {
  const normalizedRoles = normalizeCloudAppRoles(roles);
  const admin = typeof isAdmin === 'boolean' ? isAdmin : isCloudAppAdmin(normalizedRoles);
  const label = formatCloudAppRoleLabel(normalizedRoles, admin);

  return (
    <span
      className={joinClasses(
        'inline-flex items-center rounded border px-2.5 py-0.5 text-xs font-semibold',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {label}
    </span>
  );
}
