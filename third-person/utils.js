export const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function damp(current, target, response, deltaTime) {
  if (response <= 0) return target;
  return current + (target - current) * (1 - Math.exp(-deltaTime / response));
}

export function dampAngle(current, target, response, deltaTime) {
  let difference = (target - current + Math.PI) % (Math.PI * 2) - Math.PI;
  if (difference < -Math.PI) difference += Math.PI * 2;
  return current + difference * (1 - Math.exp(-deltaTime / Math.max(.001, response)));
}

export function circleIntersectsBox(x, z, radius, box) {
  const nearestX = clamp(x, box.min.x, box.max.x);
  const nearestZ = clamp(z, box.min.z, box.max.z);
  const dx = x - nearestX;
  const dz = z - nearestZ;
  return dx * dx + dz * dz < radius * radius;
}

export function verticalRangesOverlap(base, height, box) {
  return base < box.max.y - .015 && base + height > box.min.y + .015;
}

export function hexColor3(BABYLON, value) {
  return BABYLON.Color3.FromHexString(value);
}
