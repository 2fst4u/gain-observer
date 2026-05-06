import fs from 'fs';

let content = fs.readFileSync('src/store/antennaStore.ts', 'utf8');

// Fix 1: Inverted V and Sloping V rendering horizontally
// The problem is buildVWires.
const oldBuildVWires = `function buildVWires(
  state: Pick<AntennaState, 'type' | 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments'> &
    Partial<Pick<AntennaState, 'vAngle' | 'legSlope'>>
): Wire[] {
  const half = state.length / 2;
  const h = state.height;
  const [dx, dy] = orientationVector(state.orientation);

  const vAngleRad = ((state.vAngle || 120) * Math.PI) / 180;
  const halfAngle = vAngleRad / 2;

  let slopeRad = 0;
  if (state.type === 'sloping-v') {
    slopeRad = ((state.legSlope || 45) * Math.PI) / 180;
  }

  // Apex is the center
  const apex: [number, number, number] = [0, 0, h];

  // Calculate leg endpoints based on angle and slope
  // Projection on XY plane
  const projLen = half * Math.cos(slopeRad);
  const zDrop = half * Math.sin(slopeRad);

  // Rotate legs by halfAngle around Z axis relative to orientation
  const leg1DirX = dx * Math.cos(halfAngle) - dy * Math.sin(halfAngle);
  const leg1DirY = dx * Math.sin(halfAngle) + dy * Math.cos(halfAngle);

  const leg2DirX = dx * Math.cos(-halfAngle) - dy * Math.sin(-halfAngle);
  const leg2DirY = dx * Math.sin(-halfAngle) + dy * Math.cos(-halfAngle);

  const end1Z = Math.max(0.1, h - zDrop);
  const end2Z = Math.max(0.1, h - zDrop);

  const end1: [number, number, number] = [projLen * leg1DirX, projLen * leg1DirY, end1Z];
  const end2: [number, number, number] = [projLen * leg2DirX, projLen * leg2DirY, end2Z];

  const halfSeg = Math.max(3, Math.floor(state.segments / 2));

  return [
    {
      start: end1, end: apex,
      radius: state.wireRadius, segments: halfSeg, tag: DIPOLE_LEFT_TAG
    },
    {
      start: apex, end: end2,
      radius: state.wireRadius, segments: halfSeg, tag: DIPOLE_RIGHT_TAG
    }
  ];
}`;

const newBuildVWires = `function buildVWires(
  state: Pick<AntennaState, 'type' | 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments'> &
    Partial<Pick<AntennaState, 'vAngle' | 'legSlope'>>
): Wire[] {
  const half = state.length / 2;
  const h = state.height;
  const [dx, dy] = orientationVector(state.orientation);

  const vAngleRad = ((state.vAngle || 120) * Math.PI) / 180;

  let slopeRad = 0;
  let halfAngle = vAngleRad / 2;

  if (state.type === 'inverted-v') {
    // For an inverted V, the angle is in the vertical plane.
    // The legs go in opposite directions in the XY plane.
    // So horizontal angle is 180 deg (straight line from above).
    halfAngle = Math.PI / 2; // 90 deg rotation gives 180 deg spread

    // The angle between the legs is vAngle.
    // So the drop angle for each leg from horizontal is (180 - vAngle) / 2.
    slopeRad = ((180 - (state.vAngle || 120)) / 2) * Math.PI / 180;
  } else if (state.type === 'sloping-v') {
    slopeRad = ((state.legSlope || 45) * Math.PI) / 180;
  }

  // Apex is the center
  const apex: [number, number, number] = [0, 0, h];

  // Projection on XY plane and Z drop
  const projLen = half * Math.cos(slopeRad);
  const zDrop = half * Math.sin(slopeRad);

  // Rotate legs by halfAngle around Z axis relative to orientation
  const leg1DirX = dx * Math.cos(halfAngle) - dy * Math.sin(halfAngle);
  const leg1DirY = dx * Math.sin(halfAngle) + dy * Math.cos(halfAngle);

  const leg2DirX = dx * Math.cos(-halfAngle) - dy * Math.sin(-halfAngle);
  const leg2DirY = dx * Math.sin(-halfAngle) + dy * Math.cos(-halfAngle);

  const end1Z = Math.max(0.1, h - zDrop);
  const end2Z = Math.max(0.1, h - zDrop);

  const end1: [number, number, number] = [projLen * leg1DirX, projLen * leg1DirY, end1Z];
  const end2: [number, number, number] = [projLen * leg2DirX, projLen * leg2DirY, end2Z];

  const halfSeg = Math.max(3, Math.floor(state.segments / 2));

  return [
    {
      start: end1, end: apex,
      radius: state.wireRadius, segments: halfSeg, tag: DIPOLE_LEFT_TAG
    },
    {
      start: apex, end: end2,
      radius: state.wireRadius, segments: halfSeg, tag: DIPOLE_RIGHT_TAG
    }
  ];
}`;

content = content.replace(oldBuildVWires, newBuildVWires);

// Fix 2: Delta Loop feedpoint
// "The delta loop is being fed from an odd point along one element. It should be at the top of the mast."
// Right now, delta loop is built with: apex at top, fed at center of bottom wire.
// Let's modify buildDeltaLoopWires to have apex at top, and be fed at the apex.
const oldBuildDeltaLoopWires = `function buildDeltaLoopWires(
  state: Pick<AntennaState, 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments'>
): Wire[] {
  const L = state.length;
  const h = state.height;
  const [dx, dy] = orientationVector(state.orientation);

  // Apex at top, fed at center of bottom wire
  const apexZ = h;
  const apex = [0, 0, apexZ];

  // Equilateral triangle
  const side = L / 3;
  const heightTri = side * Math.sqrt(3) / 2;
  const baseZ = Math.max(0.1, h - heightTri); // Keep above ground

  const halfBase = side / 2;
  const left = [-halfBase * dx, -halfBase * dy, baseZ];
  const right = [halfBase * dx, halfBase * dy, baseZ];

  const segPerSide = Math.max(3, oddRound(state.segments / 3));

  return [
    {
      start: apex as [number, number, number], end: left as [number, number, number],
      radius: state.wireRadius, segments: segPerSide, tag: DIPOLE_LEFT_TAG
    },
    {
      start: left as [number, number, number], end: right as [number, number, number],
      radius: state.wireRadius, segments: segPerSide, tag: DIPOLE_TAG // feed wire
    },
    {
      start: right as [number, number, number], end: apex as [number, number, number],
      radius: state.wireRadius, segments: segPerSide, tag: DIPOLE_RIGHT_TAG
    }
  ];
}`;

const newBuildDeltaLoopWires = `function buildDeltaLoopWires(
  state: Pick<AntennaState, 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments'>
): Wire[] {
  const L = state.length;
  const h = state.height;
  const [dx, dy] = orientationVector(state.orientation);

  // Apex at top, fed at the apex
  const apexZ = h;
  const apex = [0, 0, apexZ];

  // Equilateral triangle
  const side = L / 3;
  const heightTri = side * Math.sqrt(3) / 2;
  const baseZ = Math.max(0.1, h - heightTri); // Keep above ground

  const halfBase = side / 2;
  const left = [-halfBase * dx, -halfBase * dy, baseZ];
  const right = [halfBase * dx, halfBase * dy, baseZ];

  const segPerSide = Math.max(3, oddRound(state.segments / 3));

  return [
    {
      start: left as [number, number, number], end: apex as [number, number, number],
      radius: state.wireRadius, segments: segPerSide, tag: DIPOLE_LEFT_TAG
    },
    {
      start: apex as [number, number, number], end: right as [number, number, number],
      radius: state.wireRadius, segments: segPerSide, tag: DIPOLE_RIGHT_TAG
    },
    {
      start: right as [number, number, number], end: left as [number, number, number],
      radius: state.wireRadius, segments: segPerSide, tag: DIPOLE_TAG
    }
  ];
}`;

content = content.replace(oldBuildDeltaLoopWires, newBuildDeltaLoopWires);

// Fix 3: Excitation point.
// "both inverted V and sloping V give the error ... nec2c exited with status -1. (no stderr)"
// The excitation logic:
//   const excitation = feedlineActive && hasShield
//     ? { wireTag: FEEDLINE_SHIELD_TAG, segment: FEEDLINE_SHIELD_SEGMENTS }
//     : feedlineActive
//       ? { wireTag: FEED_BRIDGE_TAG, segment: 1 } // shield clipped (very short feedline)
//       : { wireTag: DIPOLE_TAG, segment: dipoleCentreSeg };
//
// For inverted V and sloping V (split topology), there is NO DIPOLE_TAG, only DIPOLE_LEFT_TAG and DIPOLE_RIGHT_TAG.
// If feedline is not active, it defaults to DIPOLE_TAG which doesn't exist, causing the crash!
// Wait! Dipole single-wire HAS DIPOLE_TAG.
// But inverted V, sloping V, delta loop are split topologies even if no feedline!
// Delta loop HAS a DIPOLE_TAG (the bottom wire in my original code).
// But now I changed Delta Loop to have left, right (meeting at apex) and bottom as DIPOLE_TAG.
// If we want to feed Delta loop at the apex, the apex is the connection between DIPOLE_LEFT_TAG and DIPOLE_RIGHT_TAG.
// We should probably add a FEED_BRIDGE_TAG at the apex for delta loop? Or just feed one of the segments next to apex?
// To keep it simple and symmetric: we can just add a 1-segment FEED_BRIDGE_TAG at the apex, or we can use the existing excitation logic if we adapt it.
// Actually, single-wire dipole has DIPOLE_TAG.
// Split dipole has DIPOLE_LEFT_TAG, DIPOLE_RIGHT_TAG, and FEED_BRIDGE_TAG. (When feedline is active).
// What if feedline is NOT active for a split dipole?
// Ah! In buildDipoleWires:
//   if (!layout) {
//     return [{ start, end, tag: DIPOLE_TAG }];
//   }
// It returns a SINGLE wire.
// But buildVWires returns TWO wires: DIPOLE_LEFT_TAG and DIPOLE_RIGHT_TAG. It does NOT have a DIPOLE_TAG or FEED_BRIDGE_TAG.
// This means there's NO valid feedpoint defined for V-wires when feedline is off!
// So nec2c crashes because excitation refers to a missing wire.

const oldExcitation = `  const dipoleCentreSeg = Math.ceil(state.segments / 2);
  const excitation = feedlineActive && hasShield
    ? { wireTag: FEEDLINE_SHIELD_TAG, segment: FEEDLINE_SHIELD_SEGMENTS }
    : feedlineActive
      ? { wireTag: FEED_BRIDGE_TAG, segment: 1 } // shield clipped (very short feedline)
      : { wireTag: DIPOLE_TAG, segment: dipoleCentreSeg };`;

const newExcitation = `  const dipoleCentreSeg = Math.ceil(state.segments / 2);
  let excitationWire = DIPOLE_TAG;
  let excitationSeg = dipoleCentreSeg;

  if (feedlineActive && hasShield) {
    excitationWire = FEEDLINE_SHIELD_TAG;
    excitationSeg = FEEDLINE_SHIELD_SEGMENTS;
  } else if (feedlineActive) {
    excitationWire = FEED_BRIDGE_TAG;
    excitationSeg = 1;
  } else if (state.type === 'inverted-v' || state.type === 'sloping-v') {
    // Fed at the apex, which is the end of the left leg (or start of right leg)
    const leftWire = wires.find((w) => w.tag === DIPOLE_LEFT_TAG);
    if (leftWire) {
      excitationWire = DIPOLE_LEFT_TAG;
      excitationSeg = leftWire.segments; // The end closest to apex
    }
  } else if (state.type === 'delta-loop') {
    // Fed at the apex
    const leftWire = wires.find((w) => w.tag === DIPOLE_LEFT_TAG);
    if (leftWire) {
      excitationWire = DIPOLE_LEFT_TAG;
      excitationSeg = leftWire.segments; // The end closest to apex
    }
  }

  const excitation = { wireTag: excitationWire, segment: excitationSeg };`;

content = content.replace(oldExcitation, newExcitation);

// We should also fix termination loads for Delta Loop to be opposite the feedpoint (which is now DIPOLE_TAG, the bottom wire).
const oldLoads = `    if (state.type === 'delta-loop') {
      // Delta loop: terminated opposite feedpoint (apex)
      const apexWire = wires.find(w => w.tag === DIPOLE_RIGHT_TAG);
      if (apexWire) {
        loads.push({
          type: 4,
          wireTag: DIPOLE_RIGHT_TAG,
          segmentStart: apexWire.segments,
          segmentEnd: apexWire.segments,
          param1: state.terminatingResistor,
          param2: 0
        });
      }
    } else {`;

const newLoads = `    if (state.type === 'delta-loop') {
      // Delta loop: fed at apex, so terminated opposite feedpoint (bottom center, DIPOLE_TAG)
      const bottomWire = wires.find(w => w.tag === DIPOLE_TAG);
      if (bottomWire) {
        const midSeg = Math.ceil(bottomWire.segments / 2);
        loads.push({
          type: 4,
          wireTag: DIPOLE_TAG,
          segmentStart: midSeg,
          segmentEnd: midSeg,
          param1: state.terminatingResistor,
          param2: 0
        });
      }
    } else {`;

content = content.replace(oldLoads, newLoads);

fs.writeFileSync('src/store/antennaStore.ts', content);
