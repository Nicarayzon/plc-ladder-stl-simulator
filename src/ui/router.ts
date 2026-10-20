import { useEffect, useState } from 'react';

export function useHashRoute(): string[] {
  const get = () => (window.location.hash.replace(/^#\/?/, '') || 'inicio').split('/').map(decodeURIComponent);
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => setRoute(get());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path: string) {
  window.location.hash = `#/${path}`;
}
