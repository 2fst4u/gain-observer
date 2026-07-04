// Ah!!
// In my latest change, I used `parseFloat(m[1]!)`, `parseFloat(m[2]!)`, `parseFloat(m[5]!)`.
// But the original code was:
/*
    const zR = parseFloat(m[5]!);
    const zX = parseFloat(m[6]!);
    const power = parseFloat(m[9]!);
*/
// My indices: m[1] is V_REAL. m[2] is V_IMAG. m[5] is Z_REAL. m[6] is Z_IMAG. m[9] is POWER.
// SO I should have used `m[5]`, `m[6]`, `m[9]` !!!!
// I accidentally changed the indices to `m[1]`, `m[2]`, `m[5]`!
// That's why R was 1 and X was 0 (from V_REAL and V_IMAG)!

console.log("m[5]:", m[5], "m[6]:", m[6], "m[9]:", m[9]);
