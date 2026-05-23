import { useShallow } from 'zustand/react/shallow';
import { useAntennaStore } from '../../store/antennaStore';
import { displayLengthUnit, toDisplayLength } from '../../physics/units';
import { FEED_BRIDGE_LENGTH_M, SLOPING_V_MIN_TIP_Z_M } from '../../physics/constants';

export function GeometryStatus() {
  const {
    antennaType,
    length,
    height,
    vAngle,
    units,
  } = useAntennaStore(useShallow((s) => ({
    antennaType: s.antennaType,
    length: s.length,
    height: s.height,
    vAngle: s.vAngle,
    units: s.units,
  })));

  if (antennaType !== 'sloping-v' && antennaType !== 'inverted-v') return null;

  const unit = displayLengthUnit(units);

  if (antennaType === 'sloping-v') {
    // Sloping V: tips always at the ground floor; slope is fully determined
    // by mast height and leg length.
    const legLen = Math.max(0.01, (length - FEED_BRIDGE_LENGTH_M) / 2);
    const sinSlope = Math.max(0, height - SLOPING_V_MIN_TIP_Z_M) / legLen;
    const slopeRad = Math.asin(Math.max(0, Math.min(1, sinSlope)));
    const slopeDeg = (slopeRad * 180) / Math.PI;
    const tipZ = height - legLen * Math.sin(slopeRad);

    return (
      <section aria-labelledby="geometry-heading" style={{
        marginTop: 12,
        padding: '8px 10px',
        fontSize: 12,
        borderRadius: 4,
        background: 'var(--bg-accent)',
        border: '1px solid var(--border)',
      }}>
        <h3 id="geometry-heading" style={{ fontSize: 'inherit', margin: 0, fontWeight: 600, marginBottom: 4 }}>Geometry</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Slope angle:</span>
          <span>{slopeDeg.toFixed(1)}°</span>
          <span style={{ color: 'var(--text-muted)' }}>Tip height:</span>
          <span>{toDisplayLength(tipZ, units).toFixed(2)} {unit}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, fontStyle: 'italic', lineHeight: 1.3, color: 'var(--text-muted)' }}>
          Slope auto-snaps so tips sit at the ground floor for the current mast height and leg length.
        </div>
      </section>
    );
  }

  // Inverted V: slope is derived from vAngle and may be clamped by mast height.
  const half = length / 2;
  const maxSin = half > 0 ? (height - SLOPING_V_MIN_TIP_Z_M) / half : 0;
  const maxSlopeRad = Math.asin(Math.max(0, Math.min(1, maxSin)));
  const maxSlopeDeg = (maxSlopeRad * 180) / Math.PI;

  const requestedSlopeDeg = (180 - vAngle) / 2;
  const effectiveSlopeDeg = Math.min(requestedSlopeDeg, maxSlopeDeg);
  const effectiveSlopeRad = (effectiveSlopeDeg * Math.PI) / 180;
  const tipZ = height - half * Math.sin(effectiveSlopeRad);
  const isClamped = requestedSlopeDeg > maxSlopeDeg + 0.1;

  return (
    <section
      aria-labelledby="geometry-status-heading"
      role="status"
      aria-live="polite"
      style={{
        marginTop: 12,
        padding: '8px 10px',
        fontSize: 12,
        borderRadius: 4,
        background: isClamped ? 'rgba(255, 107, 107, 0.1)' : 'var(--bg-accent)',
        border: `1px solid ${isClamped ? '#ff6b6b' : 'var(--border)'}`,
      }}
    >
      <h3 id="geometry-status-heading" style={{ fontSize: 'inherit', margin: 0, fontWeight: 600, marginBottom: 4, color: isClamped ? '#ff6b6b' : 'inherit' }}>
        {isClamped ? '⚠️ Geometry Clamped' : 'Geometry Status'}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
        <span style={{ color: 'var(--text-muted)' }}>Max slope:</span>
        <span>{maxSlopeDeg.toFixed(1)}°</span>

        <span style={{ color: 'var(--text-muted)' }}>Effective slope:</span>
        <span style={{ color: isClamped ? '#ff6b6b' : 'inherit', fontWeight: isClamped ? 600 : 400 }}>
          {effectiveSlopeDeg.toFixed(1)}°
        </span>

        <span style={{ color: 'var(--text-muted)' }}>Tip height:</span>
        <span>{toDisplayLength(tipZ, units).toFixed(2)} {unit}</span>
      </div>
      {isClamped && (
        <div style={{ marginTop: 6, fontSize: 11, fontStyle: 'italic', lineHeight: 1.3 }}>
          Slope reduced to keep tips at least {toDisplayLength(SLOPING_V_MIN_TIP_Z_M, units).toFixed(2)} {unit} above ground.
        </div>
      )}
    </section>
  );
}
