import { StepExecutor } from '../../executor/step-executor.js';
import { Executor } from "../../executor/executor.js";
import { TraversalState } from "../traversal-state.js";
import { enter } from './enter.js';
import { checkSchema } from './check-schema.js';
import { defaults } from './defaults.js';
import { normalize } from './normalize.js';
import { checkInput } from './check-input.js';
import { resolveUnion } from './resolve-union.js';
import { checkCondition } from './check-condition.js';
import { preparePending } from './prepare-pending.js';
import { transformEarly } from './transform-early.js';
import { transform } from './transform.js';
import { checkRequired } from './check-required.js';
import { validate } from './validate.js';
import { exit } from './exit.js';

import { enterInput } from './enter-input.js';
import { enterExisting } from './enter-existing.js';
import { prepareExisting } from './prepare-existing.js';
import { serialize } from './serialize.js';
import { finalize } from './finalize.js';
import { TraversalStateExecutor } from './traversal-state-executor.js';


export const PROCESS_ENTER = /** @type {Executor<TraversalState>} */ (new StepExecutor([enter, checkSchema, defaults, normalize, checkInput, resolveUnion, checkCondition, preparePending, transformEarly]));
export const PROCESS_EXIT = /** @type {Executor<TraversalState>} */ (new StepExecutor([transform,  checkRequired, finalize, validate, exit]));
export const PROCESS_EXECUTOR = new TraversalStateExecutor(PROCESS_ENTER, PROCESS_EXIT);

export const VALIDATE_ENTER = /** @type {Executor<TraversalState>} */ (new StepExecutor([enterExisting, resolveUnion, checkCondition, prepareExisting]));
export const VALIDATE_EXIT = /** @type {Executor<TraversalState>} */ (new StepExecutor([checkRequired, validate, exit]));
export const VALIDATE_EXECUTOR = new TraversalStateExecutor(VALIDATE_ENTER, VALIDATE_EXIT);

export const SERIALIZE_ENTER = /** @type {Executor<TraversalState>} */ (new StepExecutor([enterInput, checkSchema, resolveUnion, checkCondition, serialize]));
export const SERIALIZE_EXIT = /** @type {Executor<TraversalState>} */ (new StepExecutor([exit]));
export const SERIALIZE_EXECUTOR = new TraversalStateExecutor(SERIALIZE_ENTER, SERIALIZE_EXIT);

export const PRELOAD_ENTER = /** @type {Executor<TraversalState>} */ (new StepExecutor([enterExisting, prepareExisting]));
export const PRELOAD_EXIT = /** @type {Executor<TraversalState>} */ (new StepExecutor([exit]));
export const PRELOAD_EXECUTOR = new TraversalStateExecutor(PRELOAD_ENTER, PRELOAD_EXIT);

// TODO or remove?  Unclear whether hierarchical .normalize() and .transform() are useful.
export const NORMALIZE_ENTER = new StepExecutor();
export const NORMALIZE_EXIT = new StepExecutor();
export const TRANSFORM_ENTER = new StepExecutor();
export const TRANSFORM_EXIT = new StepExecutor();

