import { useState, useEffect, useRef, useCallback } from 'react';
import animationApi from '../api/animation';

type Status = 'idle' | 'pending' | 'story_pending' | 'ready' | 'failed';

interface UseAnimationScript {
  status: Status;
  script: unknown | null;
  error: string | null;
  generate: () => void;
}

export function useAnimationScript(sessionId: number): UseAnimationScript {
  const [status, setStatus] = useState<Status>('idle');
  const [script, setScript] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    intervalRef.current = setInterval(async () => {
      try {
        const data = await animationApi.status(sessionId);
        setStatus(data.status);
        if (data.status === 'ready') {
          stopPolling();
          const s = await animationApi.script(sessionId);
          setScript(s);
        } else if (data.status === 'failed') {
          stopPolling();
          setError(data.error ?? 'Script generation failed.');
        }
      } catch (e: unknown) {
        const axiosError = e as { response?: { status?: number } };
        if (axiosError?.response?.status === 404) stopPolling();
      }
    }, 3000);
  };

  // When the analyst is still running, poll /generate every 8s until the story is ready.
  const startStoryPendingRetry = () => {
    stopPolling();
    intervalRef.current = setInterval(async () => {
      try {
        const data = await animationApi.generate(sessionId);
        if (data.status !== 'story_pending') {
          // Story is now ready and scriptwriter has been kicked off — switch to normal polling.
          stopPolling();
          setStatus('pending');
          startPolling();
        }
      } catch {
        // Keep retrying silently.
      }
    }, 8000);
  };

  const generate = useCallback(async () => {
    try {
      setStatus('pending');
      setError(null);
      const data = await animationApi.generate(sessionId);
      if (data.status === 'story_pending') {
        setStatus('story_pending');
        startStoryPendingRetry();
        return;
      }
      startPolling();
    } catch {
      setStatus('failed');
      setError('Could not start script generation.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => () => stopPolling(), []);

  return { status, script, error, generate };
}
