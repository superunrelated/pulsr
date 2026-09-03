import type { ReactNode } from 'react';

export function Card({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className="rounded bg-white p-4 shadow-sm">
      {title && (
        <h2 className="mb-3 font-serif text-sm font-semibold text-neutral-900">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
