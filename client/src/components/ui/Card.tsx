import React from 'react';

interface CardProps {
  title?: string;
  className?: string;
  children: React.ReactNode;
}

export default function Card({ title, className = '', children }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {title && <div className="card__title">{title}</div>}
      {children}
    </div>
  );
}
