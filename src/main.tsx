import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/App';
import './ui/styles.css';

render(<App />, document.getElementById('app')!);

// Offline support. When a new deploy is found the page reloads itself once, so updates show right away.
// Also check for a new version whenever the app comes back to the foreground (iPhone keeps it in memory).
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    reg.update(); // check for a new deploy every time the app opens
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update(); });
  },
});
