/** Expressive colours for fictional robots, rather than universal human emotion rules. */
export const robotHarmonies = {
  curious: { intervals: [0, 2, 7, 14], scale: [0, 2, 4, 5, 7, 9, 10] },
  calm: { intervals: [0, 4, 7, 11], scale: [0, 2, 4, 5, 7, 9, 11] },
  determined: { intervals: [0, 4, 7, 9], scale: [0, 2, 4, 5, 7, 9, 10] },
  uncertain: { intervals: [0, 5, 7, 10], scale: [0, 2, 5, 7, 9, 10, 12] },
  frustrated: { intervals: [0, 3, 6, 10], scale: [0, 2, 3, 5, 6, 8, 10] },
  sad: { intervals: [0, 3, 7, 10], scale: [0, 2, 3, 5, 7, 8, 10] },
  relieved: { intervals: [0, 4, 7, 14], scale: [0, 2, 4, 5, 7, 9, 11] },
  wonder: { intervals: [0, 4, 7, 11, 18], scale: [0, 2, 4, 6, 7, 9, 11] },
  happy: { intervals: [0, 4, 7, 9, 14], scale: [0, 2, 4, 5, 7, 9, 11] },
  celebrating: { intervals: [0, 4, 7, 11, 14, 21], scale: [0, 2, 4, 5, 7, 9, 11] },
} as const;
export type RobotMood = keyof typeof robotHarmonies;
