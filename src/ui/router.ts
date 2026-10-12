import { useEffect, useState } from 'preact/hooks';

export type Route =
  | { page: 'garage' }
  | { page: 'new' }
  | { page: 'build'; id: string }
  | { page: 'compare' }
  | { page: 'settings' };

export function parse(hash: string): Route {
  const [, page, id] = hash.replace(/^#/, '').split('/');
  if (page === 'new') return { page: 'new' };
  if (page === 'build' && id) return { page: 'build', id };
  if (page === 'compare') return { page: 'compare' };
  if (page === 'settings') return { page: 'settings' };
  return { page: 'garage' };
}

export const go = (path: string) => { location.hash = path; };

export function useRoute(): Route {
  const [r, setR] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => { setR(parse(location.hash)); window.scrollTo(0, 0); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return r;
}
