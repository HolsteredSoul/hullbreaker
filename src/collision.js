// Slab intersection returns the first contact fraction, including fast shots.
export function sweepBox(ax, ay, bx, by, box, radius = 0, ah = 0, bh = ah, verticalRadius = radius) {
  let enter = 0, leave = 1;
  const a = [ax, ay, ah], b = [bx, by, bh];
  const lo = [box.x - box.w / 2 - radius, box.y - box.d / 2 - radius, box.bottom - verticalRadius];
  const hi = [box.x + box.w / 2 + radius, box.y + box.d / 2 + radius, box.top + verticalRadius];
  for (let i = 0; i < 3; i++) {
    const delta = b[i] - a[i];
    if (Math.abs(delta) < 1e-9) { if (a[i] < lo[i] || a[i] > hi[i]) return Infinity; continue; }
    let near = (lo[i] - a[i]) / delta, far = (hi[i] - a[i]) / delta;
    if (near > far) [near, far] = [far, near];
    enter = Math.max(enter, near); leave = Math.min(leave, far);
    if (enter > leave) return Infinity;
  }
  return enter;
}
export function sweepCircle(ax, ay, bx, by, cx, cy, radius) {
  const x = ax - cx, y = ay - cy, dx = bx - ax, dy = by - ay, a = dx * dx + dy * dy;
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  if (!a) return Infinity;
  const b = x * dx + y * dy, discriminant = b * b - a * c;
  if (discriminant < 0) return Infinity;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : Infinity;
}
