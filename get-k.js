function solve(f1, a1, f2, a2) {
  const k1 = (a2 - a1*f2/f1) / (Math.sqrt(f2) - (f2/f1)*Math.sqrt(f1));
  const k2 = (a1 - k1*Math.sqrt(f1)) / f1;
  return {k1, k2};
}
console.log("RG58 10MHz=4.6 100MHz=16.1", solve(10, 4.6, 100, 16.1));
console.log("RG213 10MHz=1.9 100MHz=6.2", solve(10, 1.9, 100, 6.2));
console.log("LMR400 10MHz=1.3 100MHz=4.3", solve(10, 1.3, 100, 4.3));
