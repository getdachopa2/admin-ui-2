import React from 'react';

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-2 md:p-4">
      <div className="w-full max-w-4xl max-h-[95vh] overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-neutral-800 p-3 flex-shrink-0">
          <div className="text-base font-semibold">{title}</div>
          <button className="btn-outline text-xs px-2 py-1" onClick={onClose}>✕</button>
        </div>
        <div className="p-3 overflow-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
