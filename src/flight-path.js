export const RETURN_TURN_SECONDS = 6;
const clamp01 = n => Math.max(0, Math.min(1, n));
const smooth = t => t * t * t * (10 + t * (-15 + t * 6));
const slope = t => 30 * t * t * (1 - t) * (1 - t);

// A continuous world-space racetrack: climb out, turn 180 degrees, return
// outside the installation, turn another 180 degrees, descend onto the entry.
// The two curves meet their straight legs with matching tangent and curvature.
// Heading, pitch and bank all derive from this same path, never a separate spin.
export function returnPassPose(progress, origin, travel) {
  const u = clamp01(progress), radius = 20, lead = 24, height = 10;
  const arc = Math.PI * radius, back = travel + 2 * lead, length = lead * 2 + arc * 2 + back;
  const distance = u * u * (3 - 2 * u) * length;
  const speed = 6 * u * (1 - u) * length / RETURN_TURN_SECONDS;
  let x = 0, z = 0, heading = 0, bank = 0, pitch = 0;
  const curve = t => {
    const angle = Math.PI * t;
    const dx = 2 * radius * slope(t), dz = -radius * Math.PI * Math.cos(angle);
    const ddx = 120 * radius * t * (1 - t) * (1 - 2 * t), ddz = radius * Math.PI ** 2 * Math.sin(angle);
    const tangentSpeed = Math.hypot(dx, dz);
    const curvature = (dx * ddz - dz * ddx) / Math.max(.001, tangentSpeed ** 3);
    const actualSpeed = speed * tangentSpeed / arc;
    return { x: 2 * radius * smooth(t), z: -radius * Math.sin(angle),
      heading: -Math.atan2(dx, -dz), bank: -Math.min(.85, Math.atan(actualSpeed ** 2 * curvature / 85)) };
  };
  if (distance < lead) {
    z = -distance; pitch = Math.atan(height * slope(distance / lead) / lead);
  } else if (distance < lead + arc) {
    const p = curve((distance - lead) / arc); x = p.x; z = -lead + p.z; heading = p.heading; bank = p.bank;
  } else if (distance < lead + arc + back) {
    x = radius * 2; z = -lead + distance - lead - arc; heading = -Math.PI;
  } else if (distance < lead + arc * 2 + back) {
    const p = curve((distance - lead - arc - back) / arc);
    x = radius * 2 - p.x; z = travel + lead - p.z; heading = -Math.PI + p.heading; bank = p.bank;
  } else {
    z = travel + length - distance; heading = -Math.PI * 2;
    pitch = -Math.atan(height * slope((length - distance) / lead) / lead);
  }
  const y = height * Math.min(smooth(clamp01(distance / lead)), smooth(clamp01((length - distance) / lead)));
  return { x: origin.x + x, y, z: -origin.y + z, heading, bank, pitch };
}
