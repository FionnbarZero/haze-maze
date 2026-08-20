import { createSeededRandom } from './maze-layout.js';

export const CHAPTER_ONE_ROUTE_RUNE_ID = 'route-rune-west';
export const CHAPTER_ONE_SUNKEN_GATE_Z = -5;
export const CHAPTER_ONE_FRAGMENT_IDS = Object.freeze([
  `${CHAPTER_ONE_ROUTE_RUNE_ID}-fragment-1`,
  `${CHAPTER_ONE_ROUTE_RUNE_ID}-fragment-2`,
  `${CHAPTER_ONE_ROUTE_RUNE_ID}-fragment-3`
]);

export const CHAPTER_ONE_KEEPER_CLUES = Object.freeze([
  Object.freeze({
    id: 'keeper-trail-mark',
    title: "Keeper's trail mark",
    text: 'The Keeper crossed the Garden Maze and marked this route herself.'
  }),
  Object.freeze({
    id: 'keeper-prepared-cache',
    title: 'Prepared field cache',
    text: 'Carefully stored supplies show that the Keeper stopped and prepared instead of fleeing.'
  }),
  Object.freeze({
    id: 'keeper-command-pattern',
    title: 'Damaged command pattern',
    text: 'A damaged but authorized Coven command pattern points toward deliberate sabotage.'
  })
]);

const REQUIRED_SOCKET_POOL = Object.freeze([
  Object.freeze({ id: 'garden-required-southwest', zone: 'GARDEN_MAZE', x: -10.4, y: 0, z: -22.8 }),
  Object.freeze({ id: 'garden-required-southeast', zone: 'GARDEN_MAZE', x: 10.4, y: 0, z: -22.7 }),
  Object.freeze({ id: 'garden-required-south-center', zone: 'GARDEN_MAZE', x: 0, y: 0, z: -19.4 }),
  Object.freeze({ id: 'garden-required-midwest', zone: 'GARDEN_MAZE', x: -10.5, y: 0, z: -14.2 }),
  Object.freeze({ id: 'garden-required-mideast', zone: 'GARDEN_MAZE', x: 10.5, y: 0, z: -14.5 }),
  Object.freeze({ id: 'garden-required-gatewest', zone: 'GARDEN_MAZE', x: -7.4, y: 0, z: -8.4 }),
  Object.freeze({ id: 'garden-required-gateeast', zone: 'GARDEN_MAZE', x: 7.4, y: 0, z: -8.6 })
]);

const OPTIONAL_SOCKET_POOL = Object.freeze([
  Object.freeze({ id: 'garden-optional-south', zone: 'GARDEN_MAZE_OPTIONAL', x: -2.5, y: 0, z: -22 }),
  Object.freeze({ id: 'garden-optional-midwest', zone: 'GARDEN_MAZE_OPTIONAL', x: -7.4, y: 0, z: -11.2 }),
  Object.freeze({ id: 'garden-optional-mideast', zone: 'GARDEN_MAZE_OPTIONAL', x: 7.4, y: 0, z: -11.4 })
]);

export const CHAPTER_ONE_PLACEMENT_SOCKETS = Object.freeze([
  ...REQUIRED_SOCKET_POOL,
  ...OPTIONAL_SOCKET_POOL
]);

const REQUIRED_SOCKET_BY_ID = new Map(REQUIRED_SOCKET_POOL.map(socket => [socket.id, socket]));
const OPTIONAL_SOCKET_BY_ID = new Map(OPTIONAL_SOCKET_POOL.map(socket => [socket.id, socket]));

const deepFreeze = value => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const samePosition = (position, socket) => (
  Number.isFinite(position?.x)
    && Number.isFinite(position?.y)
    && Number.isFinite(position?.z)
    && position.x === socket.x
    && position.y === socket.y
    && position.z === socket.z
);

const shuffle = (values, random) => {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

const socketPosition = socket => ({ x: socket.x, y: socket.y, z: socket.z });

const gridKey = (xIndex, zIndex) => `${xIndex}:${zIndex}`;

export function reachableSocketIds(layout, {
  start = { x: 0, z: -24.2 },
  gridSize = .4,
  clearance = .42
} = {}) {
  const halfWidth = layout.dimensions.width / 2;
  const halfDepth = layout.dimensions.depth / 2;
  const minimumX = -halfWidth + clearance;
  const maximumX = halfWidth - clearance;
  const minimumZ = -halfDepth + clearance;
  const maximumZ = Math.min(CHAPTER_ONE_SUNKEN_GATE_Z - clearance, halfDepth - clearance);
  const columns = Math.floor((maximumX - minimumX) / gridSize) + 1;
  const rows = Math.floor((maximumZ - minimumZ) / gridSize) + 1;
  const pointFor = (xIndex, zIndex) => ({
    x: minimumX + xIndex * gridSize,
    z: minimumZ + zIndex * gridSize
  });
  const indexFor = point => ({
    x: Math.max(0, Math.min(columns - 1, Math.round((point.x - minimumX) / gridSize))),
    z: Math.max(0, Math.min(rows - 1, Math.round((point.z - minimumZ) / gridSize)))
  });
  const blocked = (x, z) => layout.walls.some(wall => (
    Math.abs(x - wall.x) <= wall.width / 2 + clearance
      && Math.abs(z - wall.z) <= wall.depth / 2 + clearance
  ));

  const startIndex = indexFor(start);
  const startPoint = pointFor(startIndex.x, startIndex.z);
  if (blocked(start.x, start.z) || blocked(startPoint.x, startPoint.z)) return new Set();
  const queue = [startIndex];
  const visited = new Set([gridKey(startIndex.x, startIndex.z)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    for (const [xOffset, zOffset] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nextX = current.x + xOffset;
      const nextZ = current.z + zOffset;
      if (nextX < 0 || nextZ < 0 || nextX >= columns || nextZ >= rows) continue;
      const key = gridKey(nextX, nextZ);
      if (visited.has(key)) continue;
      const point = pointFor(nextX, nextZ);
      if (blocked(point.x, point.z)) continue;
      visited.add(key);
      queue.push({ x: nextX, z: nextZ });
    }
  }

  return new Set(CHAPTER_ONE_PLACEMENT_SOCKETS
    .filter(socket => {
      if (socket.z >= CHAPTER_ONE_SUNKEN_GATE_Z) return false;
      const index = indexFor(socket);
      const point = pointFor(index.x, index.z);
      return !blocked(socket.x, socket.z)
        && !blocked(point.x, point.z)
        && visited.has(gridKey(index.x, index.z));
    })
    .map(socket => socket.id));
}

export function createChapterOneLevelPlan({ seed, layout }) {
  if (!layout) throw new Error('Chapter 1 level planning requires a maze layout');
  const random = createSeededRandom(`${seed}:chapter-one-plan`);
  const reachable = reachableSocketIds(layout);
  const requiredCandidates = shuffle(
    REQUIRED_SOCKET_POOL.filter(socket => reachable.has(socket.id)),
    random
  );
  const optionalCandidates = shuffle(
    OPTIONAL_SOCKET_POOL.filter(socket => reachable.has(socket.id)),
    random
  );
  const selectedRequired = requiredCandidates.slice(0, 3);
  const selectedOptional = optionalCandidates.slice(0, Math.min(1, optionalCandidates.length));

  const requiredGeodes = selectedRequired.map((socket, index) => ({
    id: `required-fragment-geode-${index + 1}`,
    socketId: socket.id,
    zone: socket.zone,
    position: socketPosition(socket),
    required: true,
    strikesRequired: 5 + Math.floor(random() * 11),
    content: {
      kind: 'route-rune-fragment',
      runeId: CHAPTER_ONE_ROUTE_RUNE_ID,
      fragmentId: CHAPTER_ONE_FRAGMENT_IDS[index],
      clue: { ...CHAPTER_ONE_KEEPER_CLUES[index] }
    }
  }));
  const optionalGeodes = selectedOptional.map((socket, index) => ({
    id: `optional-raw-crystal-geode-${index + 1}`,
    socketId: socket.id,
    zone: socket.zone,
    position: socketPosition(socket),
    required: false,
    strikesRequired: 5 + Math.floor(random() * 11),
    content: { kind: 'raw-damage-crystal', amount: 1 }
  }));

  const plan = {
    kind: 'CHAPTER_ONE_LEVEL_PLAN',
    seed: String(seed),
    routeRune: {
      id: CHAPTER_ONE_ROUTE_RUNE_ID,
      label: 'West Route-Rune',
      requiredFragments: 3
    },
    zones: {
      gardenMaze: { id: 'GARDEN_MAZE', beforeGate: true },
      rootboundCrossing: { id: 'ROOTBOUND_CROSSING', implemented: false },
      sunkenCourt: { id: 'SUNKEN_COURT', implemented: false },
      westSentinelTower: { id: 'WEST_SENTINEL_TOWER', implemented: false }
    },
    requiredGeodes,
    optionalGeodes,
    sunkenGate: {
      id: 'sunken-gate',
      z: CHAPTER_ONE_SUNKEN_GATE_Z,
      requiredRuneId: CHAPTER_ONE_ROUTE_RUNE_ID
    }
  };
  const validation = validateChapterOneLevelPlan(plan, layout);
  if (!validation.valid) {
    throw new Error(`Rejected Chapter 1 level plan: ${validation.errors.join('; ')}`);
  }
  return deepFreeze({ ...plan, validation });
}

export function validateChapterOneLevelPlan(plan, layout) {
  const errors = [];
  if (!plan || plan.kind !== 'CHAPTER_ONE_LEVEL_PLAN') errors.push('missing Chapter 1 plan identity');
  const requiredGeodes = Array.isArray(plan?.requiredGeodes) ? plan.requiredGeodes : [];
  const optionalGeodes = Array.isArray(plan?.optionalGeodes) ? plan.optionalGeodes : [];
  const reachable = layout ? reachableSocketIds(layout) : new Set();
  const requiredSocketIds = new Set(requiredGeodes.map(geode => geode.socketId));
  const optionalSocketIds = new Set(optionalGeodes.map(geode => geode.socketId));
  const allSocketIds = new Set([...requiredSocketIds, ...optionalSocketIds]);
  const requiredFragmentIds = new Set(requiredGeodes.map(geode => geode.content?.fragmentId));
  const requiredKeeperClueIds = new Set(requiredGeodes.map(geode => geode.content?.clue?.id));
  const expectedKeeperClueIds = new Set(CHAPTER_ONE_KEEPER_CLUES.map(clue => clue.id));
  const expectedFragmentIds = new Set(CHAPTER_ONE_FRAGMENT_IDS);

  if (!layout) errors.push('missing maze layout for reachability validation');
  if (plan?.routeRune?.id !== CHAPTER_ONE_ROUTE_RUNE_ID || plan?.routeRune?.requiredFragments !== 3) {
    errors.push('route-rune definition is invalid');
  }
  if (requiredGeodes.length !== 3) errors.push('exactly three required geodes are required');
  if (requiredSocketIds.size !== requiredGeodes.length) errors.push('required geode sockets must be unique');
  if (optionalSocketIds.size !== optionalGeodes.length) errors.push('optional geode sockets must be unique');
  if (allSocketIds.size !== requiredGeodes.length + optionalGeodes.length) errors.push('required and optional geodes must use separate sockets');
  if (requiredFragmentIds.size !== 3 || requiredFragmentIds.has(undefined)
    || [...expectedFragmentIds].some(fragmentId => !requiredFragmentIds.has(fragmentId))) {
    errors.push('required geodes must contain the three canonical fragment IDs');
  }
  if (requiredKeeperClueIds.size !== 3 || requiredKeeperClueIds.has(undefined)
    || [...expectedKeeperClueIds].some(clueId => !requiredKeeperClueIds.has(clueId))) {
    errors.push('required geodes must contain the three distinct Keeper clues');
  }
  for (const geode of requiredGeodes) {
    const socket = REQUIRED_SOCKET_BY_ID.get(geode.socketId);
    if (!geode.required) errors.push(`${geode.id} is not marked required`);
    if (!socket) errors.push(`${geode.id} does not use an approved required socket`);
    if (socket && (geode.zone !== socket.zone || !samePosition(geode.position, socket))) {
      errors.push(`${geode.id} does not match its approved required socket`);
    }
    if (geode.position?.z >= plan.sunkenGate?.z) errors.push(`${geode.id} is not before the Sunken Gate`);
    if (!reachable.has(geode.socketId)) errors.push(`${geode.id} is not reachable before the Sunken Gate`);
    if (geode.content?.kind !== 'route-rune-fragment') errors.push(`${geode.id} does not contain a route-rune fragment`);
    if (geode.content?.runeId !== CHAPTER_ONE_ROUTE_RUNE_ID) errors.push(`${geode.id} contains the wrong route-rune fragment`);
    const fragmentIndex = CHAPTER_ONE_FRAGMENT_IDS.indexOf(geode.content?.fragmentId);
    if (fragmentIndex < 0 || geode.content?.clue?.id !== CHAPTER_ONE_KEEPER_CLUES[fragmentIndex]?.id) {
      errors.push(`${geode.id} does not match its canonical fragment and Keeper clue`);
    }
    if (geode.strikesRequired < 5 || geode.strikesRequired > 15) errors.push(`${geode.id} has an invalid strike requirement`);
  }
  for (const geode of optionalGeodes) {
    const socket = OPTIONAL_SOCKET_BY_ID.get(geode.socketId);
    if (geode.required) errors.push(`${geode.id} incorrectly marks optional content as required`);
    if (requiredSocketIds.has(geode.socketId)) errors.push(`${geode.id} replaces a required socket`);
    if (!socket) errors.push(`${geode.id} does not use an approved optional socket`);
    if (socket && (geode.zone !== socket.zone || !samePosition(geode.position, socket))) {
      errors.push(`${geode.id} does not match its approved optional socket`);
    }
    if (!reachable.has(geode.socketId)) errors.push(`${geode.id} is not reachable before the Sunken Gate`);
    if (geode.content?.kind !== 'raw-damage-crystal' || geode.content?.amount !== 1) {
      errors.push(`${geode.id} contains invalid optional content`);
    }
    if (geode.strikesRequired < 5 || geode.strikesRequired > 15) errors.push(`${geode.id} has an invalid strike requirement`);
  }
  if (plan?.sunkenGate?.id !== 'sunken-gate'
    || plan?.sunkenGate?.z !== CHAPTER_ONE_SUNKEN_GATE_Z
    || plan?.sunkenGate?.requiredRuneId !== CHAPTER_ONE_ROUTE_RUNE_ID) {
    errors.push('Sunken Gate definition is invalid');
  }

  return {
    valid: errors.length === 0,
    errors,
    reachableRequiredGeodes: requiredGeodes.filter(geode => reachable.has(geode.socketId)).length,
    requiredFragmentCount: requiredGeodes.length,
    optionalGeodeCount: optionalGeodes.length
  };
}
