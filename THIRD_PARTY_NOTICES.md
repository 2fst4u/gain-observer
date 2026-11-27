# Third-party notices

Gain Observer as a whole is licensed under the GNU GPL v3 (see `LICENSE`).
It includes or derives from the following works, whose notices are kept here.

## nec2c

The NEC-2 engine (`public/nec2.js`, `public/nec2.wasm`) is built from nec2c by
N. Kyriazis, GPL v3. See `nec2-build/PROVENANCE.md`.

## PyIRI

`src/physics/ionosphere/iri.ts` and `src/physics/ionosphere/igrf.ts` are
TypeScript ports of parts of PyIRI 0.1.7, and the coefficient data in
`src/physics/ionosphere/data/` is converted from files distributed with it
(see `iri-build/README.md`).

Reference: Forsythe, V. V., et al. (2023), PyIRI: Whole-Globe Approach to the
International Reference Ionosphere Modeling Implemented in Python, Space
Weather.

```
MIT License

Copyright (c) 2023 victoriyaforsythe

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## International Reference Ionosphere (IRI)

The ionosphere model is the International Reference Ionosphere, developed by
the IRI Working Group (COSPAR/URSI); its CCIR and URSI-88 foF2 and M(3000)F2
coefficient maps are used. Copyright (c) International Reference Ionosphere.
IRI is distributed under its licence at
<https://irimodel.org/IRI-2020/00_iri-License.txt>, which permits use,
copying and modification provided its copyright and permission notice are
kept, and asks that the IRI Working Group be acknowledged and the paper
describing the model version be cited in scientific work:

Bilitza, D., et al. (2022), The International Reference Ionosphere model: A
review and description of an ionospheric benchmark, Reviews of Geophysics, 60.

## IGRF-13

Geomagnetic field coefficients: International Geomagnetic Reference Field,
13th generation, IAGA Working Group V-MOD. Alken, P., et al. (2021),
International Geomagnetic Reference Field: the thirteenth generation, Earth,
Planets and Space, 73, 49.

## D-layer absorption (Davies / Rawer)

`src/physics/absorption.ts` implements the non-deviative absorption formula
and winter-anomaly factors given in K. Davies, *Ionospheric Radio
Propagation*, National Bureau of Standards Monograph 80, US Department of
Commerce, 1965, eq. (5.19) and table 5.1 (a formula Davies attributes to
K. Rawer, fitted to vertical-incidence measurements at Slough). The monograph
was written by a federal employee and issued by the US Government Printing
Office, so its text is not subject to copyright in the United States (17 U.S.C.
§ 105); only an equation and four table factors are used, with citation.
Figures in the monograph reproduced by permission of other publishers are not
used. Available from NIST: https://doi.org/10.6028/NBS.MONO.80

## NOAA SWPC solar-cycle data

Smoothed and predicted 10.7 cm solar flux are fetched at run time from the
NOAA Space Weather Prediction Center (services.swpc.noaa.gov), a work of the
US Government in the public domain.
