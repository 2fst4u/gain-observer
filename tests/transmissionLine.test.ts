import { describe, expect, it } from 'vitest';
import { transmissionLineAdmittance } from '../src/physics/transmissionLine';

type C = { r: number; x: number };
const add = (a: C, b: C): C => ({ r: a.r + b.r, x: a.x + b.x });
const mul = (a: C, b: C): C => ({ r: a.r * b.r - a.x * b.x, x: a.r * b.x + a.x * b.r });
const div = (a: C, b: C): C => {
  const d = b.r * b.r + b.x * b.x;
  return { r: (a.r * b.r + a.x * b.x) / d, x: (a.x * b.r - a.r * b.x) / d };
};
function terminatedLine(z0: number, lengthWavelengths: number, loss: number, load: C) {
  const y = transmissionLineAdmittance(z0, lengthWavelengths * 299.792458 / 10, 10, loss);
  const y12 = { r: y.y12Real, x: y.y12Imag };
  const loadY = div({ r: 1, x: 0 }, load);
  const vOut = div({ r: -y12.r, x: -y12.x }, add({ r: y.y22Real, x: y.y22Imag }, loadY));
  const iIn = add({ r: y.y11Real, x: y.y11Imag }, mul(y12, vOut));
  return {
    zIn: div({ r: 1, x: 0 }, iIn),
    efficiency: (vOut.r * vOut.r + vOut.x * vOut.x) * loadY.r / iIn.r,
  };
}

describe('distributed lossy line', () => {
  it.each([0.1, 0.25, 0.5, 1.73])('keeps a matched load matched and loses exactly 6 dB at %s wavelengths', (length) => {
    const result = terminatedLine(50, length, 6, { r: 50, x: 0 });
    expect(result.zIn.r).toBeCloseTo(50, 9);
    expect(result.zIn.x).toBeCloseTo(0, 9);
    expect(result.efficiency).toBeCloseTo(10 ** (-6 / 10), 11);
  });

  it('a lossless 450-ohm quarter-wave line transforms 50 ohms to 4050 ohms', () => {
    const result = terminatedLine(450, 0.25, 0, { r: 50, x: 0 });
    expect(result.zIn.r).toBeCloseTo(4050, 8);
    expect(result.zIn.x).toBeCloseTo(0, 8);
    expect(result.efficiency).toBeCloseTo(1, 10);
  });

  it('attenuates the reflected wave on the round trip and conserves passive power', () => {
    const load = { r: 20, x: 80 };
    const result = terminatedLine(50, 0.37, 3, load);
    const gammaLoad = div({ r: load.r - 50, x: load.x }, { r: load.r + 50, x: load.x });
    const gammaIn = div({ r: result.zIn.r - 50, x: result.zIn.x }, { r: result.zIn.r + 50, x: result.zIn.x });
    const expected = mul(gammaLoad, {
      r: 10 ** (-3 / 10) * Math.cos(-4 * Math.PI * 0.37),
      x: 10 ** (-3 / 10) * Math.sin(-4 * Math.PI * 0.37),
    });
    expect(gammaIn.r).toBeCloseTo(expected.r, 10);
    expect(gammaIn.x).toBeCloseTo(expected.x, 10);
    expect(result.efficiency).toBeGreaterThan(0);
    expect(result.efficiency).toBeLessThan(10 ** (-3 / 10));
  });
});
