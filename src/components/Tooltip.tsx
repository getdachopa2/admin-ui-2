import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  label: string;
  children: ReactNode;
  /** 'top' | 'bottom' | 'left' | 'right'  */
  placement?: 'top' | 'bottom' | 'left' | 'right';
};

export default function Tooltip({ label, children, placement = 'top' }: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open || !ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();

    const margin = 8;
    let top = rect.top;
    let left = rect.left + rect.width / 2;

    switch (placement) {
      case 'top':
        top = rect.top - margin;
        break;
      case 'bottom':
        top = rect.bottom + margin;
        break;
      case 'left':
        left = rect.left - margin;
        top = rect.top + rect.height / 2;
        break;
      case 'right':
        left = rect.right + margin;
        top = rect.top + rect.height / 2;
        break;
    }
    setPos({ top, left });
  }, [open, placement]);

  useEffect(() => {
    const onScrollOrResize = () => setOpen(false);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize, true);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize, true);
    };
  }, []);

  return (
    <>
      <span
        ref={ref}
        className="inline-flex"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </span>

      {open && pos && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: pos.top,
            left: pos.left,
            transform:
              placement === 'top'
                ? 'translate(-50%, -100%)'
                : placement === 'bottom'
                ? 'translate(-50%, 0)'
                : placement === 'left'
                ? 'translate(-100%, -50%)'
                : 'translate(0, -50%)',
          }}
        >
          <div className="rounded-md bg-black/90 text-white text-xs px-2 py-1 shadow whitespace-pre">
            {label}
          </div>
        </div>
      )}
    </>
  );
}
