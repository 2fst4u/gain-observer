import { type AntennaType } from '../../../store/antennaStore';

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
