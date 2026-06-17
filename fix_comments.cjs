const fs = require('fs');

let content = fs.readFileSync('src/components/Panel/GeometryControl.tsx', 'utf8');

// 1. Hoist resonateTitles
const resonateTitlesDef = `
const resonateTitles: Record<AntennaType, string> = {
  'dipole': 'Half-wave resonant length: ~73 Ω feedpoint — close to a direct 50 Ω coax match with no ATU needed. ~2.15 dBi gain. The most practical starting point for most installations.',
  'inverted-v': 'Set length to resonant ½λ',
  'delta-loop': 'Set perimeter to resonant 1λ',
  'sloping-v': 'Set total length to 2λ (1λ per leg)',
  'terminated-delta': 'Set perimeter to 1λ',
  'vertical-whip': 'Set whip length to resonant ¼λ',
  'inverted-l': 'Set total wire length (vertical + horizontal) to resonant ¼λ. The horizontal section makes up any length the mast height falls short of a full quarter-wave.',
  'folded-dipole': 'Set each conductor to a resonant ½λ. Raw feedpoint ~300 Ω (~4× a plain dipole). A 6:1 impedance-transforming balun is enabled by default, which transforms this to ~50 Ω and reveals the characteristic narrowband resonant curve. Same gain and pattern as a plain dipole when unterminated. For a broadband T2FD, add a terminating resistor (click Z₀) and apply the suggested transformer ratio.',
};
`;

// Remove from LengthControl
content = content.replace(/  const resonateTitles: Record<AntennaType, string> = {\s*'dipole':[\s\S]*?};\n/, '');
// Remove from GeometryControl
content = content.replace(/  const resonateTitles: Record<AntennaType, string> = {\s*'dipole':[\s\S]*?};\n/, '');

// Add to top level
content = content.replace(/function LengthControl\(\) {/, resonateTitlesDef + '\nfunction LengthControl() {');


// 2. Extract calculateTfdZ0 to module scope
const tfdZ0Def = `
function calculateTfdZ0(aperture: number, radius: number): number {
  return Math.round(120 * Math.acosh(aperture / (2 * radius)));
}
`;
content = content.replace(/function LengthControl\(\) {/, tfdZ0Def + '\nfunction LengthControl() {');


// Update TerminationControl
// To address the useShallow comment, we could optimize it, but wait, the comment said:
// `TerminationControl` subscribes to `foldedDipoleAperture` and `wireRadius` via `useShallow`, and uses them to compute `tfdZ0` — but `tfdZ0` is only needed when `antennaType === 'folded-dipole'`, and the component returns `null` for all non-terminating antennas.
// We can change the hook to not subscribe if not folded dipole, or return null earlier. Actually we can't conditionally call hooks.
// What we can do is just compute tfdZ0. The comment says "Minor, but slightly undermines the blast-radius claim."
// Let's modify the useShallow to only grab those if antennaType is folded-dipole? No, Zustand's useShallow checks equality of the returned object. If we return 0 when not folded dipole, the object won't change as often.
// Or we can just leave useShallow as is and calculate it using the new helper.
content = content.replace(
  /const tfdZ0 = Math\.round\(120 \* Math\.acosh\(foldedDipoleAperture \/ \(2 \* wireRadius\)\)\);/,
  "const tfdZ0 = antennaType === 'folded-dipole' ? calculateTfdZ0(foldedDipoleAperture, wireRadius) : 0;"
);

// Update GeometryControl
content = content.replace(
  /const tfdZ0 = Math\.round\(120 \* Math\.acosh\(foldedDipoleAperture \/ \(2 \* wireRadius\)\)\);/,
  "const tfdZ0 = isFoldedDipole ? calculateTfdZ0(foldedDipoleAperture, wireRadius) : 0;"
);


// 5. Fix double blank lines
content = content.replace(/\n\n\n/g, '\n\n');

fs.writeFileSync('src/components/Panel/GeometryControl.tsx', content);
