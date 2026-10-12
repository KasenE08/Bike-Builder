import { bikes } from './data';

// Placeholder shell. Real screens arrive in Phase 5.
export function App() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: 16 }}>
      <h1 style={{ color: '#d0021b' }}>Bike Builder</h1>
      <p>{bikes.length} bike(s) loaded.</p>
    </main>
  );
}
