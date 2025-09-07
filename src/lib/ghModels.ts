// src/lib/ghModels.ts
// Tip: a CustomModel is just JSON. Keep this type loose so you can experiment.
export type CustomModel = Record<string, any>;

/** No changes to weighting (use GH's stock 'foot' fastest) */
export const CM_FASTEST_FOOT: CustomModel | undefined = undefined;

/** Placeholder you’ll tweak later (example structure only) */
export const CM_BALANCED_FOOT: CustomModel = {
  // now’s when we’d implement your “avoid big roads a bit, prefer parks a bit” ideas
  priority: [],
  speed: [],
};

/** First prototype for “coolest” — start empty; we’ll fill this next */
export const CM_COOL_FOOT_V1: CustomModel = {
  // now’s when we’d implement your biases (trees, shade, asphalt penalties, etc.)
  priority: [],
  speed: [],
};
