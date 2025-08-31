export function IndeterminateBar({ message }: { message?: string }) {
  return (
    <div className="space-y-2">
      {message && (
        <div className="text-sm text-neutral-400">{message}</div>
      )}
      <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
        <div className="h-full w-1/3 bg-primary animate-[indeterminate_1.4s_infinite]" style={{ animation: 'indeterminate 1.4s infinite' }} />
        <style>{`
          @keyframes indeterminate {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(50%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    </div>
  );
}

export function SolidProgress({ value, message }: { value: number; message?: string }) {
  return (
    <div className="space-y-2">
      {message && (
        <div className="flex justify-between text-sm text-neutral-400">
          <span>{message}</span>
          <span>{Math.round(value)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-gray-200 rounded">
        <div 
          className="h-2 bg-primary rounded transition-all duration-300" 
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }} 
        />
      </div>
    </div>
  );
}

export function RateLimitProgress({ remainingTime }: { remainingTime: number }) {
  const percentage = Math.max(0, 100 - (remainingTime / 5000) * 100); // 5 saniye base
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-yellow-400">
        <span>Rate limit aktif</span>
        <span>{Math.ceil(remainingTime / 1000)}s</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded">
        <div 
          className="h-2 bg-yellow-500 rounded transition-all duration-1000" 
          style={{ width: `${percentage}%` }} 
        />
      </div>
    </div>
  );
}
