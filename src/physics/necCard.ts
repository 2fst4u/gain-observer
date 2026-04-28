// NEC-2 "card deck" generator.
//
// The NEC-2 input is a fixed-format text file composed of "cards", each a
// two-letter mnemonic followed by up to several numeric fields. The nec2c
// parser is permissive about whitespace separators, so we emit comma-separated
// fields for readability.
//
// Card reference (abridged, see NEC-2 User Manual Part III for the full spec):
//   CM / CE  — comment block, terminated by CE
//   GW       — wire: tag, nseg, x1, y1, z1, x2, y2, z2, radius
//   GE flag  — end geometry; flag=0 free-space, flag=1 ground+structure, -1 ground no structure
//   FR kind, nfreq, _, _, f_start, f_step  — frequency card
//   EX 0, tag, seg, _, Vr, Vi — voltage source on segment
//   GN type, _, _, _, eps_r, sigma  — ground:
//       type=-1 free space (not used with GE flag=1)
//       type=0 finite ground w/ reflection coef
//       type=1 perfectly conducting
//       type=2 finite ground w/ Sommerfeld-Norton
//   RP 0, ntheta, nphi, xnda, theta0, phi0, dtheta, dphi — far-field pattern
//   XQ       — execute (run matrix solve without far-field pattern)
//   EN       — end of run
//
// We generate minimal cards for a single-frequency excitation + RP sweep.

import type { SimulationInput } from './types';

export interface BuildNecCardsOptions {
  readonly includePattern?: boolean;
}

/** Round to fixed digits without introducing trailing zeros drift. */
function n(v: number, digits = 6): string {
  if (!Number.isFinite(v)) {
    throw new Error(`Non-finite numeric value in NEC card: ${v}`);
  }
  return v.toFixed(digits);
}

export function buildNecCards(input: SimulationInput, opts: BuildNecCardsOptions = {}): string {
  const includePattern = opts.includePattern ?? true;
  const lines: string[] = [];
  lines.push('CM gain-visualiser auto-generated deck');
  lines.push(`CM f=${input.frequencyMHz} MHz  ground=${input.ground.type}`);
  lines.push('CE');

  // Geometry
  let tagCounter = 1;
  for (const w of input.wires) {
    const tag = w.tag ?? tagCounter++;
    const [x1, y1, z1] = w.start;
    const [x2, y2, z2] = w.end;
    lines.push(
      `GW ${tag} ${w.segments} ${n(x1, 5)} ${n(y1, 5)} ${n(z1, 5)} ${n(x2, 5)} ${n(y2, 5)} ${n(z2, 5)} ${n(w.radius, 5)}`,
    );
  }

  // GE flag: 1 when a real ground is present (so NEC applies image theory),
  // 0 for free space. We also need to make sure no wire touches z=0 with
  // endpoints below ground — our UI prevents this.
  const hasGround = input.ground.type !== 'free';
  lines.push(`GE ${hasGround ? 1 : 0}`);

  // Frequency: FR 0 (linear), 1 frequency, _, _, f_MHz, step
  lines.push(`FR 0 1 0 0 ${n(input.frequencyMHz, 6)} 0`);

  // Ground card (before EX per NEC-2 convention for static model).
  if (input.ground.type === 'perfect') {
    // GN 1 is perfect ground
    lines.push('GN 1');
  } else if (input.ground.type === 'real') {
    const eps = input.ground.epsilon ?? 13;
    const sig = input.ground.sigma ?? 0.005;
    // GN 2 uses Sommerfeld-Norton (more accurate, slower).
    // Params: type, _, _, _, epsilon_r, sigma
    lines.push(`GN 2 0 0 0 ${n(eps, 3)} ${n(sig, 5)}`);
  }

  // Excitation: EX 0 tag seg 0 Vr Vi
  const ex = input.excitation;
  const vr = ex.real ?? 1;
  const vi = ex.imag ?? 0;
  lines.push(`EX 0 ${ex.wireTag} ${ex.segment} 0 ${n(vr, 4)} ${n(vi, 4)}`);

  // Radiation pattern card.
  // NEC-2 RP 0 computes far-field in normal mode.
  // Angles are theta (elevation from +z axis, 0..180) and phi (azimuth, 0..360).
  // nda=1000 requests total gain (major axis) in dB.
  if (includePattern) {
    const { thetaSteps, phiSteps } = input.patternResolution;
    const dTheta = 180 / (thetaSteps - 1);
    const dPhi = 360 / phiSteps; // phi wraps, so do not subtract 1
    lines.push(
      `RP 0 ${thetaSteps} ${phiSteps} 1000 0 0 ${n(dTheta, 4)} ${n(dPhi, 4)}`,
    );
  } else {
    // Without an RP/XQ card NEC-2 never runs the matrix solve, so the
    // ANTENNA INPUT PARAMETERS block is absent from the output and we
    // can't extract impedance. XQ is the lightweight "execute" card that
    // triggers the solve and prints input parameters/currents without
    // computing a far-field pattern. This is the right card for SWR
    // sweeps where we only need R+jX.
    lines.push('XQ');
  }

  lines.push('EN');
  return lines.join('\n') + '\n';
}
