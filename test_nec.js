import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

// Generate NEC file for Inverted V, 20.06m length, 10m height, 21 segments.
// Feed at last segment of left leg.
const necContent = `CM Inverted V
CE
GW 1 11 -8.686 0 4.985 0 0 10 0.001
GW 2 11 0 0 10 8.686 0 4.985 0.001
GE 1
GN 2 0 0 0 13 0.005
EX 0 1 11 0 1 0 0
FR 0 1 0 0 7.1 0
EN
`;

writeFileSync('test.nec', necContent);
try {
  execSync('./nec2-build/nec2c-src/nec2c -i test.nec -o test.out');
  const out = readFileSync('test.out', 'utf8');
  
  // Find impedance
  const lines = out.split('\n');
  const impLine = lines.find(l => l.includes(' 7.1000 '));
  console.log(impLine);
} catch (e) {
  console.log(e.message);
}
