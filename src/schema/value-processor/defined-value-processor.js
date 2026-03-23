import { ValueProcessor } from './value-processor.js';
import { isEmpty, isPlainObject, map } from '../../utils.js';
import { SchemaLocation } from "../schema-location.js";
import { Executor } from '../executor/executor.js';
import { ComposedValueProcessor } from './composed-value-processor.js';
import { ArrayExecutor } from '../executor/array-executor.js';
import { ObjectExecutor } from '../executor/object-executor.js';
import { SchemaCompilationError, SchemaError } from '../schema-errors.js';
import { ParametersValueProcessor } from './parameters-value-processor.js';
import { FunctionValueProcessor } from './function-value-processor.js';
import { ParameterizedValueProcessor } from './parameterized-value-processor.js';

/** @import {ValueProcessorFunction, ValueProcessorDefinition, ValueProcessorArgs} from './value-processor.js' */

/**
 * @augments {ParameterizedValueProcessor}
 */
export class DefinedValueProcessor extends ParameterizedValueProcessor
{
  /**
   * @param {ValueProcessorDefinition} definition
   * @param {ValueProcessor[]|{[parameter:string]:ValueProcessor}} [args]
   */
  constructor(definition, args) {

    if (!definition.keyword) {
      throw new SchemaError('No keyword found in processor definition');
    }
    if (!definition.process) {
      throw new SchemaError('No process function found in processor definition');
    }
    if (definition.build) {
      // This should have been handled upstream!
      throw new SchemaCompilationError('Internal compiler error: factory definitions unsupported by DefinedValueProcessor');
    }

    let argsProcessor;
    let spec;


    if (definition.parameters !== undefined) {
      argsProcessor = new ParametersValueProcessor(definition.parameters, args);
      spec = {[`$${definition.keyword}`]: argsProcessor.spec}
    }
    else if (args) {
      const argSpecs = map(args, arg => arg.spec);

      if (Array.isArray(args)) {
        argsProcessor = new ComposedValueProcessor(new ArrayExecutor(args), argSpecs);
      }
      else if (typeof args === 'object') {
        argsProcessor = new ComposedValueProcessor(new ObjectExecutor(args), argSpecs)
      }
      else {
        throw new SchemaCompilationError('Internal compiler error: unsupported keyword arguments type')
      }
      spec = {[`$${definition.keyword}`]: argsProcessor.spec}
    }
    else {
      spec = `$${definition.keyword}`;
    }

    const description = definition.description ?? (definition.describe?.(args) ?? `$${definition.keyword}`)

    super(new FunctionValueProcessor(definition.process), argsProcessor, spec, description);
  }
}

