const fs = require('fs');
const content = fs.readFileSync('tests/antennaGeometry.test.ts', 'utf-8');

const importRegex = /import\s+.*?\s+from\s+['"].*?['"];?\n/g;
const imports = [];
let match;
while ((match = importRegex.exec(content)) !== null) {
  imports.push(match[0]);
}

const lines = content.split('\n');
const nonImportLines = [];
let inImport = false;
let currentImport = '';
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('import ')) {
    inImport = true;
    currentImport = line + '\n';
    if (line.includes('from ')) {
       inImport = false;
    }
  } else if (inImport) {
    currentImport += line + '\n';
    if (line.includes('} from ') || line.includes('from ')) {
      inImport = false;
    }
  } else {
    nonImportLines.push(line);
  }
}

// this regex logic wasn't fully robust for multi-line imports
// Let's do a simpler text replacement
