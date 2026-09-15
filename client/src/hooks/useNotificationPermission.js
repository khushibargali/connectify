import { useCallback, useState } from 'react';

const supported = typeof window !== 'undefined' && 'Notification' in window;

export function useNotificationPermission() {
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported');

  const request = useCallback(async () => {
    if (!supported) return 'unsupported';
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      return permission;
    }
  }, [permission]);

  return { supported, permission, request };
}
