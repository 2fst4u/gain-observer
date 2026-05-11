import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { buildWires, buildGroundParams } from './src/store/antennaStore';
import { selectSimulationInput } from './src/store/antennaStore';
import { generateNecFile } from './src/physics/necCard';

// Dummy state matching a Sloping V
const state = {
  type: 'sloping-v',
  frequency: 7.1,
  length: 40, // 4 wavelengths is 160m at 7.1MHz? Wait, wavelength = 300/7.1 = 42.25m. 4 * 42.25 = 169m. 
  height: 20,
  orientation: 0,
  wireRadius: 0.001,
  segments: 21,
  vAngle: 60,
  legSlope: 45,
  feedlineId: 'none',
  feedlineLength: 10,
  feedlineOffset: 0,
  terminatedEnabled: true,
  terminatingResistor: 450,
  matchingTransformer: 1,
};

const input = selectSimulationInput(state);
const necStr = generateNecFile(input, { sweepPoints: 1 });
writeFileSync('test.nec', necStr);

try {
  execSync('nec2-build/nec2c-src/nec2c -i test.nec -o test.out');
  const out = readFileSync('test.out', 'utf8');
  console.log(out.split('\n').filter(l => l.includes(' 7.1000 ')).join('\n'));
} catch (e) {
  console.log("Error:", e.message);
}
