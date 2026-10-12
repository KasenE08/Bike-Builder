import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Bike, Part } from '../data/types';
import { EngineSound } from '../sound/engine';
import { soundProfile } from '../sound/profile';

/** Start the engine, then hold the red button to rev. Sound follows the build's exhaust, tune, intake and turbo/supercharger. */
export function EngineSoundCard({ bike, parts }: { bike: Bike; parts: Part[] }) {
  const profile = useMemo(() => soundProfile(bike, parts), [bike, parts]);
  const key = JSON.stringify(profile);
  const eng = useRef<EngineSound | null>(null);
  const [running, setRunning] = useState(false);
  const [rpm, setRpm] = useState(0);
  const [err, setErr] = useState('');

  const stop = async () => { await eng.current?.stop(); eng.current = null; setRunning(false); };
  const start = async () => {
    setErr('');
    try {
      const e = new EngineSound(profile, setRpm);
      eng.current = e;
      await e.start();
      setRunning(true);
    } catch (x) { setErr('Sound is not available in this browser.'); eng.current = null; }
  };

  // Rebuild the sound when the build changes; always stop when leaving the page.
  useEffect(() => { if (running) { stop().then(start); } }, [key]);
  useEffect(() => () => { eng.current?.stop(); }, []);

  const throttle = (on: boolean) => (e: Event) => { e.preventDefault(); eng.current?.setThrottle(on); };
  const pct = running ? Math.min(100, (rpm / profile.redlineRpm) * 100) : 0;

  return (
    <div class="card sound">
      <div class="spread">
        <div>
          <strong>Engine sound</strong>
          <div class="muted small">{profile.label}</div>
        </div>
        <button class={running ? 'btn ghost' : 'btn'} onClick={running ? stop : start}>{running ? 'Stop' : 'Start engine'}</button>
      </div>
      <div class="tach" aria-hidden="true"><div class={pct > 92 ? 'tach-fill red' : 'tach-fill'} style={{ width: `${pct}%` }} /></div>
      <div class="spread small muted"><span>{running ? `${Math.round(rpm / 10) * 10} rpm` : 'Off'}</span><span>redline {profile.redlineRpm.toLocaleString('en-US')}</span></div>
      <button
        class="btn block rev"
        disabled={!running}
        onPointerDown={throttle(true)}
        onPointerUp={throttle(false)}
        onPointerLeave={throttle(false)}
        onPointerCancel={throttle(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        Hold to rev
      </button>
      {err && <div class="flag">{err}</div>}
      <div class="flag">Generated sound (not a recording), based on the engine's firing order and your mods. Turn the volume up.</div>
    </div>
  );
}
