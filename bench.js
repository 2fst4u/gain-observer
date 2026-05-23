const iterations = 10_000_000;
const typesToTest = ['dipole', 'vertical-whip', 'terminated-delta', 'yagi'];

console.time('Array.includes (inline)');
for (let i = 0; i < iterations; i++) {
  const type = typesToTest[i % 4];
  ['dipole', 'inverted-v', 'delta-loop', 'sloping-v', 'terminated-delta'].includes(type);
}
console.timeEnd('Array.includes (inline)');

const SET = new Set(['dipole', 'inverted-v', 'delta-loop', 'sloping-v', 'terminated-delta']);
console.time('Set.has (module scope)');
for (let i = 0; i < iterations; i++) {
  const type = typesToTest[i % 4];
  SET.has(type);
}
console.timeEnd('Set.has (module scope)');
