import { FrequencyControl } from './FrequencyControl';
import { DipoleControl } from './DipoleControl';
import { GroundControl } from './GroundControl';
import { FeedlineControl } from './FeedlineControl';
import { ModeSelector } from './ModeSelector';
import { StatsReadout } from './StatsReadout';
import { DisplayControl } from './DisplayControl';
import { SWRChart } from '../Charts/SWRChart';
import { PolarPlots } from '../Charts/PolarPlots';
import { ThemeToggle } from '../UI/ThemeToggle';
import { UnitToggle } from './UnitToggle';
import { ComparisonControl } from './ComparisonControl';

export function ControlPanel() {
  return (
    <div className="app-controls">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
      }}>
        <div>
          <div style={{ fontWeight: 700, letterSpacing: '0.04em' }}>HF GAIN VISUALIZER</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>NEC-2 · WebAssembly</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <UnitToggle />
          <ThemeToggle />
        </div>
      </div>

      <ModeSelector />
      <ComparisonControl />
      <FrequencyControl />
      <DipoleControl />
      <GroundControl />
      <FeedlineControl />
      <StatsReadout />
      <SWRChart />
      <PolarPlots />
      <DisplayControl />

      <div style={{
        marginTop: 20,
        paddingTop: 12,
        borderTop: '1px solid var(--border)',
        fontSize: 11,
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}>
        <a
          href="https://github.com/2fst4u/gain-observer"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'inherit', textDecoration: 'none' }}
          onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          View source on GitHub
        </a>
      </div>
    </div>
  );
}
