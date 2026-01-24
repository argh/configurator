import { checkDefaults } from './hooks/check-defaults.js';
import { normalizeInput } from './hooks/normalize-input.js';
import { resolveUnion } from './hooks/resolve-union.js';
import { checkCondition } from './hooks/check-condition.js';
import { preparePending } from './hooks/prepare-pending.js';
import { transform } from './hooks/transform.js';
import { checkRequired } from './hooks/check-required.js';
import { propertyStart } from './hooks/property-start.js';
import { filterProperty } from './hooks/filter-property.js';
import { checkPropertySchema } from './hooks/check-property-schema.js';
import { propertyEnd } from './hooks/property-end.js';
import { TraversalHooks } from './traversal-hooks.js';
import { validate } from './hooks/validate.js';
import { simplePending } from './hooks/simple-pending.js';
import { serialize } from './hooks/serialize.js';
import { inputToPending } from './hooks/input-to-pending.js';
import { checkUnresolved } from './hooks/check-unresolved.js';
import { pendingToValue } from './hooks/pending-to-value.js';
import { inputToValue } from './hooks/input-to-value.js';
import { copyPropertyValue } from './hooks/copy-property-value.js';

export { TraversalContext } from './traversal-context.js';
export { TraversalState } from './traversal-state.js';
export { TraversalProperty } from './traversal-property.js';
export { TraversalHooks, TraversalControl } from './traversal-hooks.js';

export const processingHooks = new TraversalHooks()
  .hook('startCurrent', [checkDefaults, normalizeInput, resolveUnion, checkCondition, preparePending, transform])
  .hook('endCurrent', [transform, resolveUnion, checkRequired, validate /*, markValuesDone*/])
  .hook('startProperty', [propertyStart, filterProperty, checkPropertySchema])
  .hook('endProperty', [propertyEnd])

export const serializationHooks = new TraversalHooks()
  .hook('startCurrent', [simplePending, resolveUnion, checkCondition, serialize])
  .hook('endCurrent', [])
  .hook('startProperty', [propertyStart, checkPropertySchema])
  .hook('endProperty', [propertyEnd])

export const validationHooks = new TraversalHooks()
  .hook('startCurrent', [resolveUnion, checkCondition, inputToPending])
  .hook('endCurrent', [resolveUnion, checkRequired, checkUnresolved, pendingToValue, validate])
  .hook('startProperty', [propertyStart, checkPropertySchema])
  .hook('endProperty', [propertyEnd])

export const normalizationHooks = new TraversalHooks()
  .hook('startCurrent', [checkDefaults, preparePending, resolveUnion])
  .hook('endCurrent', [pendingToValue, resolveUnion])
  .hook('startProperty', [propertyStart, checkPropertySchema])
  .hook('endProperty', [propertyEnd])

export const transformationHooks = new TraversalHooks()
  .hook('startCurrent', [checkDefaults, normalizeInput, resolveUnion, checkCondition, preparePending, transform])
  .hook('endCurrent', [transform, resolveUnion])
  .hook('startProperty', [propertyStart, checkPropertySchema])
  .hook('endProperty', [propertyEnd])

export const preloadHooks = new TraversalHooks()
  .hook('startCurrent', inputToValue)
  .hook('startProperty', copyPropertyValue)