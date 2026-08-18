const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

export function raySphereEntryDistance(origin, direction, center, radius, maximumDistance) {
  const offset = {
    x: origin.x - center.x,
    y: origin.y - center.y,
    z: origin.z - center.z
  };
  const directionLengthSquared = dot(direction, direction);
  if (directionLengthSquared <= Number.EPSILON || radius <= 0 || maximumDistance < 0) return null;

  const projection = dot(offset, direction);
  const discriminant = projection * projection
    - directionLengthSquared * (dot(offset, offset) - radius * radius);
  if (discriminant < 0) return null;

  const root = Math.sqrt(discriminant);
  const entry = (-projection - root) / directionLengthSquared;
  const exit = (-projection + root) / directionLengthSquared;
  if (exit < 0 || entry > maximumDistance) return null;
  return Math.max(0, entry);
}

export function blockerPrecedesTarget(blockerDistance, targetDistance, tolerance = 0) {
  return Number.isFinite(blockerDistance)
    && Number.isFinite(targetDistance)
    && blockerDistance < targetDistance - Math.max(0, tolerance);
}

export function facingYawToward(origin, target) {
  const deltaX = target.x - origin.x;
  const deltaZ = target.z - origin.z;
  if (deltaX * deltaX + deltaZ * deltaZ <= Number.EPSILON) return null;
  return Math.atan2(deltaX, deltaZ);
}
