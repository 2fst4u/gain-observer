const fs = require('fs');
const content = fs.readFileSync('.jules/archivist.md', 'utf-8');
const fixed = content.replace(
  'for the Vertical Whip and Inverted-L topologies to accurately reflect',
  'for the Vertical Whip topology (and verified existing Inverted-L docs) to accurately reflect'
);
fs.writeFileSync('.jules/archivist.md', fixed);
