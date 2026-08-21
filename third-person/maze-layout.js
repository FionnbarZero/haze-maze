const BASELINE_WIDTH = 16;
const BASELINE_DEPTH = 30;

const hashSeed = value => {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const createSeededRandom = seed => {
  let state = hashSeed(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
};

const shuffle = (values, random) => {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

const horizontalPartition = ({ id, z, width, gapCenter, gapWidth = 3.8, thickness }) => {
  const interiorMinimum = -width / 2 + thickness;
  const interiorMaximum = width / 2 - thickness;
  const gapMinimum = gapCenter - gapWidth / 2;
  const gapMaximum = gapCenter + gapWidth / 2;
  return [
    {
      id: `${id}-west`,
      x: (interiorMinimum + gapMinimum) / 2,
      z,
      width: Math.max(.1, gapMinimum - interiorMinimum),
      depth: thickness
    },
    {
      id: `${id}-east`,
      x: (gapMaximum + interiorMaximum) / 2,
      z,
      width: Math.max(.1, interiorMaximum - gapMaximum),
      depth: thickness
    }
  ];
};

const verticalPartition = ({ id, x, minimumZ, maximumZ, gapCenter, gapWidth = 3.2, thickness }) => {
  const gapMinimum = gapCenter - gapWidth / 2;
  const gapMaximum = gapCenter + gapWidth / 2;
  return [
    {
      id: `${id}-south`,
      x,
      z: (minimumZ + gapMinimum) / 2,
      width: thickness,
      depth: Math.max(.1, gapMinimum - minimumZ)
    },
    {
      id: `${id}-north`,
      x,
      z: (gapMaximum + maximumZ) / 2,
      width: thickness,
      depth: Math.max(.1, maximumZ - gapMaximum)
    }
  ];
};

export const createMazeLayout = ({
  seed = 'moonhollow-expanded-v1',
  width = 28,
  depth = 52,
  wallThickness = .5
} = {}) => {
  const random = createSeededRandom(seed);
  const walls = [];
  const columnCenters = [-8.8, 0, 8.8];
  const horizontalBoundaries = [-17, -5, 5, 16];
  const roomBands = [
    [-depth / 2 + wallThickness, -17],
    [-17, -5],
    [-5, 5],
    [5, 16],
    [16, depth / 2 - wallThickness]
  ];

  for (const z of horizontalBoundaries) {
    const isRuneDoor = z === -5;
    const gapCenter = isRuneDoor ? 0 : columnCenters[Math.floor(random() * columnCenters.length)];
    walls.push(...horizontalPartition({
      id: isRuneDoor ? 'first-rune-door-partition' : `room-row-${z}`,
      z,
      width,
      gapCenter,
      gapWidth: isRuneDoor ? 4.4 : 3.9,
      thickness: wallThickness
    }));
  }

  roomBands.forEach(([minimumZ, maximumZ], bandIndex) => {
    for (const [partitionIndex, x] of [-4.65, 4.65].entries()) {
      const span = maximumZ - minimumZ;
      const gapCenter = minimumZ + span * (.3 + random() * .4);
      walls.push(...verticalPartition({
        id: `room-column-${bandIndex}-${partitionIndex}`,
        x,
        minimumZ,
        maximumZ,
        gapCenter,
        thickness: wallThickness
      }));
    }
  });

  const dragonCandidates = shuffle([
    [-9.4, -21], [9.1, -20.4], [-8.8, -12], [8.9, -11.4],
    [-9.2, -.2], [9.2, .4], [-8.9, 9.8], [8.8, 10.6],
    [-9.1, 19.7], [0, 20.5], [9, 20.2], [-.2, -11.5]
  ], random).slice(0, 9);
  const dragonSpawns = [
    {
      id: 'dragon-0',
      x: (random() - .5) * .35,
      z: 9 + (random() - .5) * .35,
      aggressive: true,
      patrolRadius: 0,
      patrolSpeed: 0
    },
    ...dragonCandidates.map(([x, z], index) => ({
      id: `dragon-${index + 1}`,
      x: x + (random() - .5) * 1.1,
      z: z + (random() - .5) * 1.1,
      aggressive: true,
      patrolRadius: .55 + random() * .45,
      patrolSpeed: .55 + random() * .45
    }))
  ];

  const fountainPositions = [-19, -7, 7, 19].flatMap((z, row) => [
    { id: `fountain-west-${row}`, x: -width / 2 + 1.05, z, rotationY: Math.PI / 2 },
    { id: `fountain-east-${row}`, x: width / 2 - 1.05, z, rotationY: -Math.PI / 2 }
  ]);

  const treePositions = [
    [-12, -22], [-7, -18.5], [11.8, -20], [7.2, -14],
    [-11.7, -8], [11.6, -2], [-7.7, 2.4], [7.8, 7.8],
    [-11.8, 12], [11.8, 15], [-7.8, 21], [7.4, 22]
  ].map(([x, z], index) => ({ id: `tree-${index}`, x, z, scale: .78 + random() * .25 }));

  const creaturePositions = [
    [-2.4, -19], [2.7, -10], [-2.9, -1], [2.8, 8], [-2.7, 17], [2.5, 22]
  ].map(([x, z], index) => ({
    id: ['sky-fox', 'moon-marten', 'ember-hare', 'moss-kit', 'star-vole', 'briar-hare'][index],
    x,
    z,
    scale: .36 + random() * .08,
    rotationY: random() * Math.PI * 2
  }));

  return {
    seed: String(seed),
    dimensions: {
      width,
      depth,
      area: width * depth,
      baselineArea: BASELINE_WIDTH * BASELINE_DEPTH,
      areaMultiplier: width * depth / (BASELINE_WIDTH * BASELINE_DEPTH)
    },
    walls,
    dragonSpawns,
    fountainPositions,
    treePositions,
    creaturePositions
  };
};
