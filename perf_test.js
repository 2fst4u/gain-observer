const numElements = 360;
const iterations = 50000;

function cutAzimuth_mock() {
    const out = new Array(numElements);
    for (let pi = 0; pi < numElements; pi++) {
        out[pi] = Math.random() * 10 - 5;
    }
    return out;
}

function normaliseForPolar_old(values, maxDb, rangeDb) {
  const min = maxDb - rangeDb;
  const len = values.length;
  const out = new Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = Math.max(0, values[i] - min);
  }
  return out;
}

function normaliseForPolar_new(values, maxDb, rangeDb) {
  const min = maxDb - rangeDb;
  const len = values.length;
  for (let i = 0; i < len; i++) {
    values[i] = Math.max(0, values[i] - min);
  }
  return values;
}

let start = performance.now();
for (let i = 0; i < iterations; i++) {
  const cut = cutAzimuth_mock();
  normaliseForPolar_old(cut, 5, 20);
}
let end = performance.now();
const oldTime = end - start;
console.log('Old version took:', oldTime, 'ms');

start = performance.now();
for (let i = 0; i < iterations; i++) {
  const cut = cutAzimuth_mock();
  normaliseForPolar_new(cut, 5, 20);
}
end = performance.now();
const newTime = end - start;
console.log('New version took:', newTime, 'ms');
console.log('Improvement:', ((oldTime - newTime) / oldTime * 100).toFixed(2), '%');
