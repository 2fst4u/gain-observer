import { readFileSync } from 'fs';

function oddRound(v: number): number {
  const n = Math.max(1, Math.round(v));
  return n % 2 === 0 ? n + 1 : n;
}

const state = {
  type: 'inverted-v',
  length: 20.06,
  height: 10,
  orientation: 'EW',
  wireRadius: 0.001,
  segments: 21,
  vAngle: 120,
  legSlope: 45,
  feedlineId: 'rg58',
  feedlineLength: 10,
  feedlineOffset: 0,
  terminatedEnabled: false
};

const half = state.length / 2;
const h = state.height;
const dx = 1;
const dy = 0;
const bridgeHalf = 0.05 / 2; // 0.025

const apexZ = h;
let end1: [number, number, number];
let end2: [number, number, number];

const slopeRad = ((180 - state.vAngle) / 2) * Math.PI / 180;
const zDrop = half * Math.sin(slopeRad);
const tipZ = Math.max(0.1, h - zDrop);
const actualProj = Math.sqrt(Math.max(0.001, half * half - (h - tipZ) * (h - tipZ)));
end1 = [-actualProj * dx, -actualProj * dy, tipZ];
end2 = [+actualProj * dx, +actualProj * dy, tipZ];

const legActualLen = Math.hypot(end1[0], end1[1], end1[2] - apexZ);
const segDensity = state.segments / state.length;
const legSegs = Math.max(3, oddRound((legActualLen - bridgeHalf) * segDensity));

const dx1 = end1[0] / legActualLen;
const dy1 = end1[1] / legActualLen;
const dz1 = (end1[2] - apexZ) / legActualLen;
const apexLeft = [bridgeHalf * dx1, bridgeHalf * dy1, apexZ + bridgeHalf * dz1];

const dx2 = end2[0] / legActualLen;
const dy2 = end2[1] / legActualLen;
const dz2 = (end2[2] - apexZ) / legActualLen;
const apexRight = [bridgeHalf * dx2, bridgeHalf * dy2, apexZ + bridgeHalf * dz2];

console.log('slopeRad', slopeRad * 180 / Math.PI);
console.log('zDrop', zDrop);
console.log('actualProj', actualProj);
console.log('end1', end1);
console.log('end2', end2);
console.log('legActualLen', legActualLen);
console.log('legSegs', legSegs);
console.log('apexLeft', apexLeft);
console.log('apexRight', apexRight);

const dist = Math.hypot(apexRight[0] - apexLeft[0], apexRight[1] - apexLeft[1], apexRight[2] - apexLeft[2]);
console.log('bridgeLength', dist);

console.log('leftLegLength', Math.hypot(apexLeft[0] - end1[0], apexLeft[1] - end1[1], apexLeft[2] - end1[2]));
