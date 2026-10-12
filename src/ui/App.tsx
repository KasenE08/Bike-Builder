import { useEffect, useState } from 'preact/hooks';
import { DEFAULT_SETTINGS, getSettings, listBuilds, type SavedBuild, type Settings } from '../store/db';
import { BikePicker } from './BikePicker';
import { BuildEditor } from './BuildEditor';
import { Compare } from './Compare';
import { Garage } from './Garage';
import { SettingsPage } from './SettingsPage';
import { useRoute } from './router';

const Icon = ({ d }: { d: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={d} /></svg>
);

export function App() {
  const route = useRoute();
  const [builds, setBuilds] = useState<SavedBuild[] | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const refresh = () => listBuilds().then(setBuilds);
  useEffect(() => { refresh(); getSettings().then(setSettings); }, []);

  if (!builds) return null;
  let page;
  if (route.page === 'new') page = <BikePicker onCreated={refresh} />;
  else if (route.page === 'build') {
    const b = builds.find((x) => x.id === route.id);
    page = b ? <BuildEditor key={b.id} initial={b} riderLb={settings.riderLb} onChanged={refresh} /> : <main><p>Build not found.</p></main>;
  } else if (route.page === 'compare') page = <Compare builds={builds} riderLb={settings.riderLb} />;
  else if (route.page === 'settings') page = <SettingsPage settings={settings} onSaved={setSettings} />;
  else page = <Garage builds={builds} riderLb={settings.riderLb} />;

  const tab = route.page === 'compare' || route.page === 'settings' ? route.page : 'garage';
  return (
    <>
      {page}
      <nav class="tabs">
        <a href="#/" aria-current={tab === 'garage' ? 'page' : undefined}><Icon d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />Garage</a>
        <a href="#/compare" aria-current={tab === 'compare' ? 'page' : undefined}><Icon d="M8 4v16M16 4v16M4 8h8M12 16h8" />Compare</a>
        <a href="#/settings" aria-current={tab === 'settings' ? 'page' : undefined}><Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12h2M3 12h2M12 3v2M12 19v2M17 7l1.5-1.5M5.5 18.5L7 17M17 17l1.5 1.5M5.5 5.5L7 7" />Settings</a>
      </nav>
    </>
  );
}
