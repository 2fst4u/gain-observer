# Accuracy repair status

The review led to the following implementation changes. Tests use the real
committed NEC Wasm where physical solver behaviour matters; analytic circuit
checks independently verify feed-network calculations.

| Finding | Implemented repair | Regression evidence |
|---|---|---|
| Folded mesh creates artificial power | Align parallel longitudinal cells and source/load cells; reject invalid or excessive meshes rather than silently capping them | `geometryAccuracy.integration.test.ts`: nine frequency/aperture cases and independent mesh refinement |
| Ordinary cable attenuation absent | Distributed complex line two-port and exact ideal-transformer cascade; rebuild networks at each frequency | `transmissionLine.test.ts`, `physicalMetrics.integration.test.ts` |
| Horizon integral invents power below ground | Explicit sphere/hemisphere support and correct endpoint weights; fixed scientific 2° sampling | `patternIntegral.test.ts`, `averageGainTest.integration.test.ts` |
| Tuning changes installed counterpoises | Persist design frequency separately; preserve wire endpoints while tuning | `antennaStateAccuracy.test.ts`, `counterpoiseGeometry.test.ts`, `modelAccuracyMapping.test.ts` |
| Terminated-delta choked feed fails convergence | Reject that configuration with an actionable explanation; clear stale results after failure | `averageGainTest.integration.test.ts`, `usePhysicsEngine.test.tsx` |
| Match ignores reactance | Use complex impedance and compare allowed ratios around the continuous SWR optimum | `impedance.test.ts`, `TransformerControl.test.tsx` |
| ATU assumes a matched 450 Ω main line | Explicit finite-Q L circuit feeding separate 50 Ω RG-213 main coax; no double subtraction of NEC cable loss | `atu.test.ts`, `modelAccuracyMapping.test.ts` |
| Propagation disagrees with realized gain | Share feed-system metrics; remove uncalibrated availability and signal-quality predictions | `propagation.test.ts`, `PropagationControl.test.tsx` |
| Manual longitude silently zero | Add manual longitude and disclose solar context's location | `PropagationInputs.test.tsx`, `propagation.test.ts` |
| Reference comparisons lose hardware settings | Snapshot matching, design and termination state; same metrics and geometry in both views | `StatsReadout.test.tsx`, `swrChartUtils.test.ts`, `AntennaScene.test.tsx` |
| Termination power includes choke heat | Attribute resistor heat from identified loads; show conductor/network losses separately | `terminationDiagnostics.test.ts`, `StatsReadout.test.tsx` |

Additional repairs model copper conductivity, use fixed near-ground clearance
over real soil, distinguish escaping efficiency from the NEC budget, avoid
interpreting current-envelope range as reflection, and route the full cable
outside the loop plane so it cannot accidentally connect to the base.

The default ray view is now an explicit ideal-shell geometry illustration.
Actual ionospheric coverage and received SNR require a validated propagation
model and a link budget; they are not supplied by this implementation.

Two limitations remain explicit: the choked terminated-delta feed has not been
numerically repaired, and the original native engine source/toolchain has not
been recovered. The former is blocked; the latter is documented with unchanged
artifact hashes and verified-source gates for future builds in
[`nec2-build/PROVENANCE.md`](../nec2-build/PROVENANCE.md). Neither is disguised
as a completed scientific validation.

After rebasing onto the current main branch, clean-install validation passed
108 test files / 1,194 tests with no skips, ESLint, TypeScript checks and the
production build. No production deployment is part of this repair.
