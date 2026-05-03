'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { formatUtcDateTime } from '@/lib/formatters';

export default function RelativeTime({ value, prefix = '', className = '' }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!value) {
    return null;
  }

  const fallback = formatUtcDateTime(value);
  const fallbackValue = fallback ? `${prefix}${fallback}` : '';
  const relativeValue = `${prefix}${formatDistanceToNow(new Date(value), { addSuffix: true })}`;

  return (
    <span className={className} suppressHydrationWarning>
      {hydrated ? relativeValue : fallbackValue}
    </span>
  );
}
