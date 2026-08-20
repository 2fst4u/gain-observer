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
//   LD type, tag, seg_start, seg_end, P1, P2, P3 — segment loading:
//       type=0 series RLC (R Ω, L H, C F)
//       type=4 impedance Z = R + jX (P1=R, P2=X)
//   TL tag1, seg1, tag2, seg2, Z0, length, Y1r, Y1i, Y2r, Y2i — transmission line:
//       Lossless ideal TL between two segments. Length in metres. Negative
//       Z0 indicates a crossover (balanced-line phase reversal).
//   RP 0, ntheta, nphi, xnda, theta0, phi0, dtheta, dphi — far-field pattern
//   XQ       — execute (run matrix solve without far-field pattern)
//   EN       — end of run
//
// We generate minimal cards for a single-frequency excitation + RP sweep,
// with optional LD/TL cards for feedline modelling.

import type { NetworkLoad, SegmentLoad, SimulationInput, TransmissionLine, Wire } from './types';

export interface BuildNecCardsOptions {
  readonly includePattern?: boolean;
  /** Number of frequency steps for a linear sweep. Default 1. */
  readonly sweepPoints?: number;
  /** Frequency step size in MHz for a sweep. Default 0. */
  readonly sweepStep?: number;
  /** Start frequency for a sweep. Defaults to input.frequencyMHz. */
  readonly sweepStartFreq?: number;
}

/** Geometry cards (GW): one per wire, auto-numbering untagged wires. */
function buildGeometryCards(lines: string[], wires: readonly Wire[]): void {
  let tagCounter = 1;
  const len = wires.length;
  for (let i = 0; i < len; i++) {
    const w = wires[i];
    const tag = w.tag ?? tagCounter++;
    const start = w.start;
    const end = w.end;
    const x1 = start[0];
    const y1 = start[1];
    const z1 = start[2];
    const x2 = end[0];
    const y2 = end[1];
    const z2 = end[2];
    const r = w.radius;

    if (!Number.isFinite(x1)) throw new Error(`Non-finite numeric value in NEC card: ${x1}`);
    if (!Number.isFinite(y1)) throw new Error(`Non-finite numeric value in NEC card: ${y1}`);
    if (!Number.isFinite(z1)) throw new Error(`Non-finite numeric value in NEC card: ${z1}`);
    if (!Number.isFinite(x2)) throw new Error(`Non-finite numeric value in NEC card: ${x2}`);
    if (!Number.isFinite(y2)) throw new Error(`Non-finite numeric value in NEC card: ${y2}`);
    if (!Number.isFinite(z2)) throw new Error(`Non-finite numeric value in NEC card: ${z2}`);
    if (!Number.isFinite(r)) throw new Error(`Non-finite numeric value in NEC card: ${r}`);
    lines.push(
      'GW ' + tag + ' ' + w.segments + ' ' + x1.toFixed(5) + ' ' + y1.toFixed(5) + ' ' + z1.toFixed(5) + ' ' + x2.toFixed(5) + ' ' + y2.toFixed(5) + ' ' + z2.toFixed(5) + ' ' + r.toFixed(5)
    );
  }
}

/** Loading cards (LD): segment loads such as a choke balun. */
function buildLoadingCards(lines: string[], loads?: readonly SegmentLoad[]): void {
  if (!loads) return;
  for (let i = 0; i < loads.length; i++) {
    const ld = loads[i];
    if (ld.type === 0) {
      // Series RLC: P1=R Ω, P2=L H, P3=C F.
      const p3 = ld.param3 ?? 0;
      if (!Number.isFinite(ld.param1)) throw new Error(`Non-finite numeric value in NEC card: ${ld.param1}`);
      if (!Number.isFinite(ld.param2)) throw new Error(`Non-finite numeric value in NEC card: ${ld.param2}`);
      if (!Number.isFinite(p3)) throw new Error(`Non-finite numeric value in NEC card: ${p3}`);
      lines.push(
        'LD 0 ' + ld.wireTag + ' ' + ld.segmentStart + ' ' + ld.segmentEnd + ' ' + ld.param1.toFixed(5) + ' ' + ld.param2.toFixed(8) + ' ' + p3.toFixed(12)
      );
    } else {
      // Impedance load: P1=R Ω, P2=X Ω.
      if (!Number.isFinite(ld.param1)) throw new Error(`Non-finite numeric value in NEC card: ${ld.param1}`);
      if (!Number.isFinite(ld.param2)) throw new Error(`Non-finite numeric value in NEC card: ${ld.param2}`);
      lines.push(
        'LD 4 ' + ld.wireTag + ' ' + ld.segmentStart + ' ' + ld.segmentEnd + ' ' + ld.param1.toFixed(5) + ' ' + ld.param2.toFixed(5)
      );
    }
  }
}

/** Network cards (NT): non-radiating two-port networks. */
function buildNetworkCards(lines: string[], networks?: readonly NetworkLoad[]): void {
  if (!networks) return;
  for (let i = 0; i < networks.length; i++) {
    const nt = networks[i];
    const y11i = nt.y11Imag ?? 0;
    const y12i = nt.y12Imag ?? 0;
    const y22i = nt.y22Imag ?? 0;
    if (!Number.isFinite(nt.y11Real)) throw new Error(`Non-finite numeric value in NEC card: ${nt.y11Real}`);
    if (!Number.isFinite(y11i)) throw new Error(`Non-finite numeric value in NEC card: ${y11i}`);
    if (!Number.isFinite(nt.y12Real)) throw new Error(`Non-finite numeric value in NEC card: ${nt.y12Real}`);
    if (!Number.isFinite(y12i)) throw new Error(`Non-finite numeric value in NEC card: ${y12i}`);
    if (!Number.isFinite(nt.y22Real)) throw new Error(`Non-finite numeric value in NEC card: ${nt.y22Real}`);
    if (!Number.isFinite(y22i)) throw new Error(`Non-finite numeric value in NEC card: ${y22i}`);
    lines.push(
      'NT ' + nt.fromTag + ' ' + nt.fromSegment + ' ' + nt.toTag + ' ' + nt.toSegment + ' ' + nt.y11Real.toFixed(6) + ' ' + y11i.toFixed(6) + ' ' + nt.y12Real.toFixed(6) + ' ' + y12i.toFixed(6) + ' ' + nt.y22Real.toFixed(6) + ' ' + y22i.toFixed(6)
    );
  }
}

/**
 * Transmission-line cards (TL): differential signal in coax/parallel line.
 * NEC's TL card is lossless and non-radiating by definition.
 */
function buildTransmissionLineCards(lines: string[], transmissionLines?: readonly TransmissionLine[]): void {
  if (!transmissionLines) return;
  for (let i = 0; i < transmissionLines.length; i++) {
    const tl = transmissionLines[i];
    const y1r = tl.shuntAdmEnd1Real ?? 0;
    const y1i = tl.shuntAdmEnd1Imag ?? 0;
    const y2r = tl.shuntAdmEnd2Real ?? 0;
    const y2i = tl.shuntAdmEnd2Imag ?? 0;
    if (!Number.isFinite(tl.z0)) throw new Error(`Non-finite numeric value in NEC card: ${tl.z0}`);
    if (!Number.isFinite(tl.lengthM)) throw new Error(`Non-finite numeric value in NEC card: ${tl.lengthM}`);
    if (!Number.isFinite(y1r)) throw new Error(`Non-finite numeric value in NEC card: ${y1r}`);
    if (!Number.isFinite(y1i)) throw new Error(`Non-finite numeric value in NEC card: ${y1i}`);
    if (!Number.isFinite(y2r)) throw new Error(`Non-finite numeric value in NEC card: ${y2r}`);
    if (!Number.isFinite(y2i)) throw new Error(`Non-finite numeric value in NEC card: ${y2i}`);
    lines.push(
      'TL ' + tl.fromTag + ' ' + tl.fromSegment + ' ' + tl.toTag + ' ' + tl.toSegment + ' ' + tl.z0.toFixed(4) + ' ' + tl.lengthM.toFixed(5) + ' ' + y1r.toFixed(6) + ' ' + y1i.toFixed(6) + ' ' + y2r.toFixed(6) + ' ' + y2i.toFixed(6)
    );
  }
}

export function buildNecCards(input: SimulationInput, opts: BuildNecCardsOptions = {}): string {
  const includePattern = opts.includePattern ?? true;
  const lines: string[] = [];
  lines.push('CM gain-visualiser auto-generated deck');
  lines.push(`CM f=${input.frequencyMHz} MHz  ground=${input.ground.type}`);
  lines.push('CE');

  // Geometry
  buildGeometryCards(lines, input.wires);

  // GE flag: 1 when a real ground is present (so NEC applies image theory),
  // 0 for free space. We also need to make sure no wire touches z=0 with
  // endpoints below ground — our UI prevents this.
  const hasGround = input.ground.type !== 'free';
  lines.push(`GE ${hasGround ? 1 : 0}`);

  // Frequency: FR 0 (linear), n frequency, _, _, f_MHz, step
  const sweepPoints = opts.sweepPoints ?? 1;
  const sweepStep = opts.sweepStep ?? 0;
  const freqStart = opts.sweepStartFreq ?? input.frequencyMHz;
  // If not sweeping, keep step as strictly "0" for exact fixture match.
  const stepStr = sweepPoints > 1 ? sweepStep.toFixed(6) : '0';
  if (!Number.isFinite(freqStart)) throw new Error(`Non-finite numeric value in NEC card: ${freqStart}`);
  if (sweepPoints > 1 && !Number.isFinite(sweepStep)) throw new Error(`Non-finite numeric value in NEC card: ${sweepStep}`);
  lines.push('FR 0 ' + sweepPoints + ' 0 0 ' + freqStart.toFixed(6) + ' ' + stepStr);

  // Ground card (before EX per NEC-2 convention for static model).
  if (input.ground.type === 'perfect') {
    // GN 1 is perfect ground
    lines.push('GN 1');
  } else if (input.ground.type === 'real') {
    const eps = input.ground.epsilon ?? 13;
    const sig = input.ground.sigma ?? 0.005;
    if (!Number.isFinite(eps)) throw new Error(`Non-finite numeric value in NEC card: ${eps}`);
    if (!Number.isFinite(sig)) throw new Error(`Non-finite numeric value in NEC card: ${sig}`);
    // GN 2 uses Sommerfeld-Norton (more accurate, slower).
    // Params: type, _, _, _, epsilon_r, sigma
    lines.push('GN 2 0 0 0 ' + eps.toFixed(3) + ' ' + sig.toFixed(5));
  }

  // Loading cards (LD): segment loads such as a choke balun.
  buildLoadingCards(lines, input.loads);

  // Network cards (NT): non-radiating two-port networks.
  buildNetworkCards(lines, input.networks);

  // Transmission-line cards (TL): differential signal in coax/parallel
  // line. NEC's TL card is lossless and non-radiating by definition.
  buildTransmissionLineCards(lines, input.transmissionLines);

  // Excitation: EX 0 tag seg 0 Vr Vi
  const ex = input.excitation;
  const vr = ex.real ?? 1;
  const vi = ex.imag ?? 0;
  if (!Number.isFinite(vr)) throw new Error(`Non-finite numeric value in NEC card: ${vr}`);
  if (!Number.isFinite(vi)) throw new Error(`Non-finite numeric value in NEC card: ${vi}`);
  lines.push('EX 0 ' + ex.wireTag + ' ' + ex.segment + ' 0 ' + vr.toFixed(4) + ' ' + vi.toFixed(4));

  // Radiation pattern card.
  // NEC-2 RP 0 computes far-field in normal mode.
  // Angles are theta (elevation from +z axis, 0..180) and phi (azimuth, 0..360).
  // nda=1000 requests total gain (major axis) in dB.
  if (includePattern) {
    const { thetaSteps, phiSteps } = input.patternResolution;
    const dTheta = 180 / (thetaSteps - 1);
    const dPhi = 360 / phiSteps; // phi wraps, so do not subtract 1
    if (!Number.isFinite(dTheta)) throw new Error(`Non-finite numeric value in NEC card: ${dTheta}`);
    if (!Number.isFinite(dPhi)) throw new Error(`Non-finite numeric value in NEC card: ${dPhi}`);
    lines.push(
      'RP 0 ' + thetaSteps + ' ' + phiSteps + ' 1000 0 0 ' + dTheta.toFixed(4) + ' ' + dPhi.toFixed(4)
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
