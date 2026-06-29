const loEdge = 7.0;
const hiEdge = 7.3;

const broadBands = [
  { fLow: 1.0, fHigh: 1.5 },
  { fLow: 3.5, fHigh: 4.0 },
  { fLow: 7.0, fHigh: 7.3 },
  { fLow: 14.0, fHigh: 14.35 },
  { fLow: 21.0, fHigh: 21.45 },
];

const primaryBands = [
  { fLow: 7.0, fHigh: 7.3 }
];

function oldWay() {
  const extraBands = broadBands.filter(
    (b) => b.fHigh < loEdge - 0.5 || b.fLow > hiEdge + 0.5,
  );
  if (extraBands.length > 0) {
    const merged = [...extraBands, ...primaryBands].sort((a, b) => a.fLow - b.fLow);
    return merged;
  }
  return primaryBands;
}

function newWaySimple() {
  let merged: typeof primaryBands | null = null;
  for (let i = 0; i < broadBands.length; i++) {
    const b = broadBands[i];
    if (b.fHigh < loEdge - 0.5 || b.fLow > hiEdge + 0.5) {
      if (!merged) merged = [...primaryBands];
      merged.push(b);
    }
  }
  if (merged) {
    merged.sort((a, b) => a.fLow - b.fLow);
    return merged;
  }
  return primaryBands;
}

const ITERATIONS = 10000000;

console.time('oldWay');
for (let i = 0; i < ITERATIONS; i++) {
  oldWay();
}
console.timeEnd('oldWay');

console.time('newWaySimple');
for (let i = 0; i < ITERATIONS; i++) {
  newWaySimple();
}
console.timeEnd('newWaySimple');
