import { render } from 'preact';

function App() {
  return <main style={{ fontFamily: 'system-ui', padding: 24 }}>Bike Builder — scaffold</main>;
}

render(<App />, document.getElementById('app')!);
