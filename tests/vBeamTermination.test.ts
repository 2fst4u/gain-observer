/**
 * V-antenna termination topology tests.
 *
 * Topology: Option A — a single NEC NT card (two-port network) connecting the
 * far tip of the left leg to the far tip of the right leg.
 *
 * IMPORTANT: `terminatingResistor` is the *total across-tip* resistance, not a
 * per-leg-to-ground value. A single NT card represents the full resistor.
 *
 * Wire orientation in NEC deck:
 *   Left leg  (tag DIPOLE_LEFT_TAG=1):  start=far-tip, end=apex → segment 1 = far tip
 *   Right leg (tag DIPOLE_RIGHT_TAG=2): start=apex, end=far-tip → segment N = far tip
 *
 * NT admittance matrix for a resistor R between ports:
 *   Y11 = Y22 = 1/R,  Y12 = -1/R
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import { buildNecCards } from '../src/physics/necCard';
import {
  getNecLines,
  parseGwLine,
  parseNtLine,
  expectNoGroundTouchingWires,
  expectExcitation,
} from './necInspect';
import { DIPOLE_LEFT_TAG, DIPOLE_RIGHT_TAG, FEED_BRIDGE_TAG } from '../src/physics/constants';

describe('V-antenna termination (Option A: NT across tips)', () => {
  beforeEach(() => {
    const store = useAntennaStore.getState();
    store.setAntennaType('v-beam');
    store.setFrequency(14.15);
    store.setLength(42);  // 2λ total (21m per leg at ~14 MHz)
    store.setHeight(15);
    store.setVAngle(90);
    store.setTerminatingResistor(0); // reset to unterminated
  });

  describe('unterminated (terminatingResistor = 0)', () => {
    it('emits no NT card when terminatingResistor is 0', () => {
      const input = selectSimulationInput(useAntennaStore.getState());
      const deck = buildNecCards(input);
      expect(deck).not.toContain('\nNT ');
    });

    it('networks field is undefined when unterminated', () => {
      const input = selectSimulationInput(useAntennaStore.getState());
      expect(input.networks).toBeUndefined();
    });
  });

  describe('terminated (terminatingResistor > 0)', () => {
    it('emits exactly one NT card for v-beam with Rterm=600', () => {
      useAntennaStore.getState().setTerminatingResistor(600);
      const input = selectSimulationInput(useAntennaStore.getState());
      const deck = buildNecCards(input);

      const ntLines = getNecLines(deck, 'NT');
      expect(ntLines).toHaveLength(1);
    });

    it('NT card connects left far tip (tag=1, seg=1) to right far tip (tag=2, seg=N)', () => {
      useAntennaStore.getState().setTerminatingResistor(600);
      const state = useAntennaStore.getState();
      const input = selectSimulationInput(state);
      const deck = buildNecCards(input);

      const ntLines = getNecLines(deck, 'NT');
      const nt = parseNtLine(ntLines[0]);

      // Port 1: left leg far tip
      expect(nt.tag1).toBe(DIPOLE_LEFT_TAG);
      expect(nt.seg1).toBe(1);

      // Port 2: right leg far tip — segment count equals the right leg's NEC segments
      const gwLines = getNecLines(deck, 'GW');
      const rightLegLine = gwLines.find(l => parseGwLine(l).tag === DIPOLE_RIGHT_TAG);
      expect(rightLegLine).toBeDefined();
      const rightLeg = parseGwLine(rightLegLine!);
      expect(nt.tag2).toBe(DIPOLE_RIGHT_TAG);
      expect(nt.seg2).toBe(rightLeg.segments);
    });

    it('NT admittance matrix encodes total across-tip resistance (Y = 1/R)', () => {
      const Rterm = 600;
      const G = 1 / Rterm;
      useAntennaStore.getState().setTerminatingResistor(Rterm);
      const input = selectSimulationInput(useAntennaStore.getState());
      const deck = buildNecCards(input);

      const nt = parseNtLine(getNecLines(deck, 'NT')[0]);
      expect(nt.y11Real).toBeCloseTo(G, 8);
      expect(nt.y22Real).toBeCloseTo(G, 8);
      expect(nt.y12Real).toBeCloseTo(-G, 8);

      // Imaginary parts must all be zero (pure resistor)
      expect(nt.y11Imag).toBeCloseTo(0, 8);
      expect(nt.y12Imag).toBeCloseTo(0, 8);
      expect(nt.y22Imag).toBeCloseTo(0, 8);
    });

    it('changing Rterm changes admittance values predictably', () => {
      const store = useAntennaStore.getState();

      store.setTerminatingResistor(300);
      const deck300 = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
      const nt300 = parseNtLine(getNecLines(deck300, 'NT')[0]);

      store.setTerminatingResistor(600);
      const deck600 = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
      const nt600 = parseNtLine(getNecLines(deck600, 'NT')[0]);

      // Halving R doubles conductance G = 1/R
      expect(nt300.y11Real).toBeCloseTo(nt600.y11Real * 2, 8);
      expect(nt300.y12Real).toBeCloseTo(nt600.y12Real * 2, 8);
    });

    it('networks array contains exactly one entry with correct Y-params', () => {
      const Rterm = 450;
      const G = 1 / Rterm;
      useAntennaStore.getState().setTerminatingResistor(Rterm);
      const input = selectSimulationInput(useAntennaStore.getState());

      expect(input.networks).toHaveLength(1);
      const net = input.networks![0];
      expect(net.fromTag).toBe(DIPOLE_LEFT_TAG);
      expect(net.fromSegment).toBe(1);
      expect(net.toTag).toBe(DIPOLE_RIGHT_TAG);
      expect(net.y11Real).toBeCloseTo(G, 10);
      expect(net.y12Real).toBeCloseTo(-G, 10);
      expect(net.y22Real).toBeCloseTo(G, 10);
    });

    it('NT card appears before EX in deck (NEC card order)', () => {
      useAntennaStore.getState().setTerminatingResistor(600);
      const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));

      const ntIdx = deck.indexOf('\nNT ');
      const exIdx = deck.indexOf('\nEX ');
      expect(ntIdx).toBeGreaterThan(0);
      expect(exIdx).toBeGreaterThan(ntIdx);
    });

    it('no wires touch or go below ground (z > 0 for all endpoints)', () => {
      useAntennaStore.getState().setTerminatingResistor(600);
      const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
      expect(() => expectNoGroundTouchingWires(deck)).not.toThrow();
    });

    it('excitation remains on the apex bridge (FEED_BRIDGE_TAG, segment 1)', () => {
      useAntennaStore.getState().setTerminatingResistor(600);
      const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
      expectExcitation(deck, FEED_BRIDGE_TAG, 1);
    });
  });

  describe('sloping-v antenna also uses the same NT topology', () => {
    beforeEach(() => {
      const store = useAntennaStore.getState();
      store.setAntennaType('sloping-v');
      store.setFrequency(7.1);
      store.setLength(84);  // 2λ total at 7.1 MHz
      store.setHeight(20);
      store.setVAngle(90);
      store.setLegSlope(20);
    });

    it('emits no NT card when unterminated', () => {
      useAntennaStore.getState().setTerminatingResistor(0);
      const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
      expect(deck).not.toContain('\nNT ');
    });

    it('emits one NT card for sloping-v with Rterm=500', () => {
      useAntennaStore.getState().setTerminatingResistor(500);
      const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
      expect(getNecLines(deck, 'NT')).toHaveLength(1);
    });

    it('NT connects left far tip to right far tip with correct G=1/R', () => {
      const Rterm = 500;
      useAntennaStore.getState().setTerminatingResistor(Rterm);
      const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
      const nt = parseNtLine(getNecLines(deck, 'NT')[0]);

      expect(nt.tag1).toBe(DIPOLE_LEFT_TAG);
      expect(nt.seg1).toBe(1);
      expect(nt.tag2).toBe(DIPOLE_RIGHT_TAG);
      expect(nt.y11Real).toBeCloseTo(1 / Rterm, 8);
      expect(nt.y12Real).toBeCloseTo(-1 / Rterm, 8);
      expect(nt.y22Real).toBeCloseTo(1 / Rterm, 8);
    });

    it('no wires touch ground even with sloped legs', () => {
      useAntennaStore.getState().setTerminatingResistor(500);
      const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
      expect(() => expectNoGroundTouchingWires(deck)).not.toThrow();
    });
  });

  describe('other antenna types are unaffected', () => {
    it('dipole with terminatingResistor set emits no NT card', () => {
      const store = useAntennaStore.getState();
      store.setAntennaType('dipole');
      store.setTerminatingResistor(600);
      const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
      expect(deck).not.toContain('\nNT ');
    });

    it('inverted-v with terminatingResistor set emits no NT card', () => {
      const store = useAntennaStore.getState();
      store.setAntennaType('inverted-v');
      store.setTerminatingResistor(600);
      const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
      expect(deck).not.toContain('\nNT ');
    });

    it('delta-loop with terminatingResistor set emits no NT card', () => {
      const store = useAntennaStore.getState();
      store.setAntennaType('delta-loop');
      store.setTerminatingResistor(600);
      const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
      expect(deck).not.toContain('\nNT ');
    });
  });
});
