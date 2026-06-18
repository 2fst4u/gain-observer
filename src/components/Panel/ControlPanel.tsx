import { FrequencyControl } from './FrequencyControl';
import { GeometryControl } from './GeometryControl';
import { GroundControl } from './GroundControl';
import { FeedlineControl } from './FeedlineControl';
import { ModeSelector } from './ModeSelector';
import { StatsReadout } from './StatsReadout';
import { PropagationControl } from './PropagationControl';
import { DisplayControl } from './DisplayControl';
import { SWRChart } from '../Charts/SWRChart';
import { PolarPlots } from '../Charts/PolarPlots';
import { ThemeToggle } from '../UI/ThemeToggle';
import { UnitToggle } from './UnitToggle';
import { ComparisonControl } from './ComparisonControl';

export function ControlPanel() {
  return (
    <>
      {/* SEO: Use <aside> for sidebar content instead of a generic <div> */}
      <aside className="app-controls">
        {/* SEO: Use <header> for structural grouping of introductory content */}
        <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
      }}>
        <div>
          {/* SEO: Add a proper <h1> tag as the document's heading hierarchy root */}
          <h1 style={{ margin: 0, fontSize: 'inherit', fontWeight: 700, letterSpacing: '0.04em' }}>HF GAIN VISUALIZER</h1>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>NEC-2 · WebAssembly</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <UnitToggle />
          <ThemeToggle />
        </div>
      </header>

      <ModeSelector />
      <ComparisonControl />
      <FrequencyControl />
      <GeometryControl />
      <GroundControl />
      <FeedlineControl />
      <StatsReadout />
      <SWRChart />
      <PolarPlots />
      <PropagationControl />
      <DisplayControl />

      {/* SEO: Use <footer> for secondary links and metadata at the end of a section */}
      <footer style={{
        marginTop: 20,
        paddingTop: 12,
        borderTop: '1px solid var(--border)',
        fontSize: 11,
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}>
        {/* SEO: Add title attribute to external link for better context and discoverability */}
        <a
          href="https://github.com/2fst4u/gain-observer"
          target="_blank"
          rel="noopener noreferrer"
          title="View source code on GitHub"
          style={{ color: 'inherit', textDecoration: 'none' }}
          onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          Source code on GitHub
        </a>
        </footer>
      </aside>
    </>
  );
}
