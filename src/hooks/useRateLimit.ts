// src/hooks/useRateLimit.ts
import { useState, useCallback } from 'react';

interface RateLimitConfig {
  minInterval: number; // milliseconds
  maxConcurrent?: number;
}

export function useRateLimit(config: RateLimitConfig) {
  const [lastRequest, setLastRequest] = useState<number>(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [activeRequests, setActiveRequests] = useState(0);
  
  const canMakeRequest = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequest;
    const hasMinIntervalPassed = timeSinceLastRequest >= config.minInterval;
    const underConcurrentLimit = !config.maxConcurrent || activeRequests < config.maxConcurrent;
    
    return hasMinIntervalPassed && underConcurrentLimit && !isBlocked;
  }, [lastRequest, activeRequests, config.minInterval, config.maxConcurrent, isBlocked]);

  const executeRequest = useCallback(async <T>(
    requestFn: () => Promise<T>
  ): Promise<T> => {
    if (!canMakeRequest()) {
      const waitTime = Math.max(0, config.minInterval - (Date.now() - lastRequest));
      throw new Error(`Rate limit aktif. ${Math.ceil(waitTime / 1000)} saniye sonra tekrar deneyin.`);
    }

    setLastRequest(Date.now());
    setActiveRequests(prev => prev + 1);
    
    try {
      const result = await requestFn();
      return result;
    } finally {
      setActiveRequests(prev => prev - 1);
    }
  }, [canMakeRequest, config.minInterval, lastRequest]);

  const getRemainingTime = useCallback(() => {
    if (canMakeRequest()) return 0;
    return Math.max(0, config.minInterval - (Date.now() - lastRequest));
  }, [canMakeRequest, config.minInterval, lastRequest]);

  return {
    canMakeRequest: canMakeRequest(),
    executeRequest,
    remainingTime: getRemainingTime(),
    activeRequests,
    block: () => setIsBlocked(true),
    unblock: () => setIsBlocked(false)
  };
}
