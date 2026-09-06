const fs = require('fs');

const path = 'tests/impedance.test.ts';
let content = fs.readFileSync(path, 'utf8');

// I need to add tests for matchRatioForFeedpoint handling non-finite numbers which I deleted
// Wait, I didn't delete those, matchRatioForFeedpoint tests are still there... let's check
const hasMatchRatio = content.includes("describe('matchRatioForFeedpoint'");
console.log('Has matchRatioForFeedpoint:', hasMatchRatio);
