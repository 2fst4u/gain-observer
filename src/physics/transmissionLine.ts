import { wavelengthMeters } from './constants';

export interface LineAdmittance {
  readonly y11Real: number;
  readonly y11Imag: number;
  readonly y12Real: number;
  readonly y12Imag: number;
  readonly y22Real: number;
  readonly y22Imag: number;
}

/**
 * Distributed line two-port, using its measured matched attenuation and real Z0.
 * Y11 = Y22 = coth(gamma*l)/Z0; Y12 = -csch(gamma*l)/Z0.
 * `electricalLengthM` is physical length / velocity factor. Attenuation is the
 * one-way matched power loss in dB, hence alpha*l = lossDb*ln(10)/20.
 * This retains phase, reflected-wave attenuation and dissipated power together;
 * resistors tacked onto a lossless TL do not reproduce those properties.
 */
export function transmissionLineAdmittance(
  z0: number,
  electricalLengthM: number,
  frequencyMHz: number,
  matchedLossDb: number,
): LineAdmittance {
  if (!(z0 > 0) || !(frequencyMHz > 0) || electricalLengthM < 0 || matchedLossDb < 0 ||
      ![z0, electricalLengthM, frequencyMHz, matchedLossDb].every(Number.isFinite)) {
    throw new Error('Invalid transmission-line parameters');
  }
  const alpha = matchedLossDb * Math.LN10 / 20;
  const beta = 2 * Math.PI * electricalLengthM / wavelengthMeters(frequencyMHz);
  const sinhReal = Math.sinh(alpha) * Math.cos(beta);
  const sinhImag = Math.cosh(alpha) * Math.sin(beta);
  const coshReal = Math.cosh(alpha) * Math.cos(beta);
  const coshImag = Math.sinh(alpha) * Math.sin(beta);
  const denominator = z0 * (sinhReal * sinhReal + sinhImag * sinhImag);
  if (!(denominator > 0) || !Number.isFinite(denominator)) {
    throw new Error('Degenerate transmission-line two-port');
  }
  const y11Real = (coshReal * sinhReal + coshImag * sinhImag) / denominator;
  const y11Imag = (coshImag * sinhReal - coshReal * sinhImag) / denominator;
  return {
    y11Real, y11Imag,
    y12Real: -sinhReal / denominator,
    y12Imag: sinhImag / denominator,
    y22Real: y11Real,
    y22Imag: y11Imag,
  };
}
