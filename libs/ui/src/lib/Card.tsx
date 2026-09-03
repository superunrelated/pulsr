import type { ReactNode } from 'react';

export function Card({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      {title && (
        <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      )}
      {children}
    </div>
  );
}
