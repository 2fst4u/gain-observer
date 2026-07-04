// What went wrong?
// Oh!
// The capture groups in `m` changed because I added `(?:(?!(?:ANTENNA INPUT PARAMETERS)).*?\n){1,12}?`!
// The group `(?:(?!(?:ANTENNA INPUT PARAMETERS)).*?\n)` is a NON-CAPTURING group! It starts with `?:`.
// But wait!
// The capture groups:
// `(-?\d\.\d+E[+-]\d+)`
// Let's test the capture group indices!
const regex = /ANTENNA INPUT PARAMETERS(?:(?!(?:ANTENNA INPUT PARAMETERS)).*?\n){1,12}?(?:^\s+\d+\s+\d+\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+))/gm;

const text = `
ANTENNA INPUT PARAMETERS
  TAG SEG  V_REAL V_IMAG   I_REAL I_IMAG   Z_REAL Z_IMAG   Y_REAL Y_IMAG   POWER
   1   1  1.0000E+00  2.0000E+00  3.0000E+00  4.0000E+00  5.0000E+00  6.0000E+00  7.0000E+00  8.0000E+00  9.0000E+00
`;

regex.lastIndex = 0;
const m = regex.exec(text);
console.log("m[1]:", m[1]);
console.log("m[2]:", m[2]);
console.log("m[5]:", m[5]);
