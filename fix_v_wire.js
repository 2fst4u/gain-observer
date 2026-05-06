import fs from 'fs';

let content = fs.readFileSync('src/store/antennaStore.ts', 'utf8');

// For V wires, we want apex as the center and it should point down to the ground.
// Actually, for an inverted V, the apex is the highest point, and legs slope *downward*.
// For sloping V, it's tilted.

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
  const halfAngle = vAngleRad / 2;

  let slopeRad = 0;
  // For inverted-V, the legs slope downward relative to the apex.
  // We can treat it as a special case of sloping-v where the slope is calculated from the V angle,
  // or define the geometry directly.
  // Actually, V angle is the angle BETWEEN the legs.
  // For an inverted V, the angle is in the vertical plane (usually) or tilted.
  // Let's assume standard inverted V: apex is high, legs go down. The angle between them is vAngle.
  // The drop angle for each leg from horizontal is (180 - vAngle)/2.
  // So slopeRad = ((180 - vAngle) / 2) * Math.PI / 180.

  if (state.type === 'inverted-v') {
    slopeRad = ((180 - (state.vAngle || 120)) / 2) * Math.PI / 180;
  } else if (state.type === 'sloping-v') {
    slopeRad = ((state.legSlope || 45) * Math.PI) / 180;
  }

  // Apex is the center
  const apex: [number, number, number] = [0, 0, h];

  // Projection on XY plane and Z drop
  const projLen = half * Math.cos(slopeRad);
  const zDrop = half * Math.sin(slopeRad);

  // If we just use dx, dy for the legs, they are in the same plane.
  // Standard inverted V: legs go in opposite directions but slope down.
  // If vAngle is meant to be the angle *between* the legs when viewed from above (like a V-beam),
  // then the original logic of rotating by halfAngle is correct for a horizontal V-beam.
  // If inverted V means legs are in a straight line from above but sloped down, that's a dipole with drooping ends.
  // Let's assume V-beam: angle between legs in horizontal plane is vAngle.
  // For sloping V: a V-beam that is tilted.
  // Wait, standard inverted V is a dipole supported at the center, legs drop down. The angle is between the legs.
  // Let's re-read PR comment: "The inverted V is also rendering horizontally rather than down to the ground."
  // This means my original logic had zDrop = 0 for inverted V because I only set slopeRad for sloping-v!
  // And the angle should be the angle between the legs in the vertical plane? Or is it a V-beam?
  // Let's make slopeRad based on vAngle for inverted V if it's supposed to drop down.
  // Actually, "inverted V" usually means the angle between the legs is vAngle. So slope is (180 - vAngle)/2.
  // Let's set it up so the legs go in opposite directions (dx, dy and -dx, -dy) but slope down.
  // Or do they form a V shape from above? "both inverted V and sloping V give the error ... rendering horizontally"
  // Let's fix inverted V to slope down.
  // Let's check what Delta Loop feedpoint comment means: "The delta loop is being fed from an odd point along one element. It should be at the top of the mast."
  // Delta loop: "fed ... at the top of the mast" - wait, delta loop fed at the apex? Or fed at the bottom center?
  // "It should be at the top of the mast" means fed at the apex.
}`;

// We will just do targeted replaces.
