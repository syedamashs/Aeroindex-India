import { type ReactNode } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Card({ title, subtitle, action, children, className = '', bodyClassName = '' }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            {title && <h3 className="section-title">{title}</h3>}
            {subtitle && <p className="section-subtitle mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={`px-5 pb-5 ${bodyClassName}`}>{children}</div>
    </div>
  );
}
