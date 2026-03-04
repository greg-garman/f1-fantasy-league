import React from 'react';

interface BadgeProps {
  variant?: 'gold' | 'green' | 'blue' | 'gray' | 'danger';
  children: React.ReactNode;
}

export default function Badge({ variant = 'gray', children }: BadgeProps) {
  return <span className={`badge badge--${variant}`}>{children}</span>;
}
