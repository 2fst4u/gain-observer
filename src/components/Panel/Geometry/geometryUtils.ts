import type { AntennaType } from '../../../store/antennaStore';
import { FOLDED_DIPOLE_FEED_R_OHMS } from '../../../physics/constants';

export const resonateTitles: Record<AntennaType, string> = {
  'dipole': 'Half-wave resonant length: ~73 Ω feedpoint — close to a direct 50 Ω coax match with no ATU needed. ~2.15 dBi gain. The most practical starting point for most installations.',
  'inverted-v': 'Set length to resonant ½λ',
  'delta-loop': 'Set perimeter to resonant 1λ',
  'sloping-v': 'Set total length to 2λ (1λ per leg)',
  'terminated-delta': 'Set perimeter to 1λ',
  'vertical-whip': 'Set whip length to resonant ¼λ',
  'inverted-l': 'Set total wire length (vertical + horizontal) to resonant ¼λ. The horizontal section makes up any length the mast height falls short of a full quarter-wave.',
  'folded-dipole': 'Set each conductor to a resonant ½λ. Raw feedpoint ~300 Ω (~4× a plain dipole). A 9:1 impedance-transforming balun is enabled by default — a compromise that lands both the plain and the terminated antenna under 1.7:1, since terminating adds the resistor in series with the feedpoint. Same gain and pattern as a plain dipole when unterminated. For a broadband T2FD, add the recommended 300 Ω terminating resistor and apply the suggested transformer ratio.',
};

export function calculateTfdZ0(aperture: number, radius: number): number {
  return Math.round(120 * Math.acosh(aperture / (2 * radius)));
}

export function getTerminationHint(
  antennaType: AntennaType,
  terminatingResistor: number,
  tfdZ0: number
): string {
  if (terminatingResistor === 0) {
    if (antennaType === 'folded-dipole') {
      return 'Unterminated: a classic folded dipole — ~300 Ω feedpoint, narrowband, same gain and pattern as a plain dipole. Add a resistor for a broadband terminated folded dipole (T2FD); the recommended 300 Ω costs 3 dB, the least you can pay for broadband behaviour. Use the Match button in the Transformer section below to apply the suggested ratio.';
    }
    return 'Unterminated: travelling wave reflects, creating a standing-wave pattern. Use this mode to check whether the antenna structure resonates at the design frequency.';
  }

  if (antennaType === 'sloping-v') {
    return `${terminatingResistor} Ω resistors at each tip (to ground). Click Off to remove termination and inspect resonance. Affects gain, directivity, front/back ratio, feedpoint impedance, realized gain, and termination loss. Lower SWR alone does not indicate the best design point.`;
  }

  if (antennaType === 'folded-dipole') {
    const lossDb = (10 * Math.log10(1 + terminatingResistor / FOLDED_DIPOLE_FEED_R_OHMS)).toFixed(1);
    return `${terminatingResistor} Ω resistor at the centre of the conductor opposite the feed. It sits at that conductor's current maximum, so it lands at the feedpoint almost 1:1 — raw feedpoint ≈ ${terminatingResistor + FOLDED_DIPOLE_FEED_R_OHMS} Ω — and costs about ${lossDb} dB of gain (10·log10(1 + R/${FOLDED_DIPOLE_FEED_R_OHMS})). The pattern shape is unchanged; watch Directivity hold still while Gain drops. Use the Match button in the Transformer section below to apply the optimal ratio (the transformer is never changed automatically). Raising R toward the two-wire line's Z₀ (≈ ${tfdZ0} Ω here) flattens SWR further at a steep price in gain; lowering it keeps gain but narrows the usable range. Click Off to restore the plain folded dipole.`;
  }

  return `${terminatingResistor} Ω resistor on a short bridge wire spanning the gap at the centre of the base (not to ground). Click Off to remove termination and inspect resonance. Affects gain, directivity, front/back ratio, feedpoint impedance, realized gain, and termination loss. Lower SWR alone does not indicate the best design point.`;
}
