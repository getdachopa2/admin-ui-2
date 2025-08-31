import React from 'react';

export default function ClearInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  label,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'password';
  label?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label && <div className="mb-1 text-xs text-neutral-400">{label}</div>}
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          className="input pr-9"
        />
        {value && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-md text-neutral-400 hover:bg-neutral-800"
            onClick={() => onChange('')}
            aria-label="Temizle"
            title="Temizle"
          >
            ×
          </button>
        )}
      </div>
    </label>
  );
}
