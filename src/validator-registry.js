import { lookup } from 'node:dns/promises';

import fs from 'node:fs/promises';

import { constants } from 'node:fs';
import { ConfiguratorError } from './configurator-error.js';
export class ValidatorError extends ConfiguratorError {}

export class ValidatorRegistry
{
  constructor() {
    this.validators = new Map();
    this._registerBuiltInValidators();
  }

  /**
   * Register a custom validator keyword
   * @param {string} keyword - Validator keyword (without $)
   * @param {Function} validatorFn - Validation function (sync or async)
   * @returns {ValidatorRegistry} This registry instance
   * @throws {ValidatorError}
   */
  register(keyword, validatorFn) {
    if (typeof validatorFn !== 'function') {
      throw new ValidatorError(`Validator for keyword '${keyword}' must be a function`);
    }
    this.validators.set(keyword, validatorFn);
    return this;
  }

  /**
   * Get a validator function by keyword
   * @param {string} keyword - Validator keyword (without $)
   * @returns {Function|null} Validator function or null if not found
   */
  get(keyword) {
    return this.validators.get(keyword) ?? null;
  }

  /**
   * Check if a validator keyword exists
   * @param {string} keyword - Validator keyword (without $)
   * @returns {boolean} True if validator exists
   */
  has(keyword) {
    return this.validators.has(keyword);
  }

  /**
   * Create a child registry that inherits from this one
   * @returns {ValidatorRegistry} New registry with inherited validators
   */
  createChild() {
    const child = new ValidatorRegistry();
    // Copy all validators from parent
    for (const [keyword, validator] of this.validators) {
      child.validators.set(keyword, validator);
    }
    return child;
  }

  async validate(value, validatorSpec) {

    try {
      if (!validatorSpec) {
        return value;
      }
      let validatorFunction = this.getValidatorFunction(validatorSpec);

      if (!validatorFunction) {
        return value;
      }

      const validated = await validatorFunction(value);

      if ((value !== undefined) && (validated === undefined)) {
        // return value;  // only devmode error?
        throw new ValidatorError('Internal validation error: bad validator!')
      }

      if (validated instanceof Error) {
        throw new ValidatorError(validated.message);
      }

      return validated;
    }
    catch (error) {
      throw error;
    }
  }

  /**
   * Wrap a user-provided validator specification into a validation function
   * @param {*} validatorSpec - The validator specification
   * @returns {Function} Async validation function that returns true or error message
   */
  getValidatorFunction(validatorSpec) {
    // Already a function - wrap to ensure it's async
    if (typeof validatorSpec === 'function') {
      return async (value) => await validatorSpec(value);
    }

    // Regular expression object
    if (validatorSpec instanceof RegExp) {
      return async (value) => {
        if (!validatorSpec.test(String(value))) {
          throw new ValidatorError(`Value does not match pattern ${validatorSpec}`);
        }
        return value;
      };
    }

    // String handling
    if (typeof validatorSpec === 'string') {
      // String regex pattern "/pattern/flags"
      if (validatorSpec.startsWith('/') && validatorSpec.lastIndexOf('/') > 0) {
        const lastSlash = validatorSpec.lastIndexOf('/');
        const pattern = validatorSpec.slice(1, lastSlash);
        const flags = validatorSpec.slice(lastSlash + 1);

        try {
          const regex = new RegExp(pattern, flags);
          return async (value) => {
            if (!regex.test(String(value))) {
              throw new ValidatorError(`Value does not match pattern ${validatorSpec}`);
            }
            return value;
          };
        } catch (error) {
          throw new ValidatorError(`Invalid regex pattern: ${validatorSpec}`);
        }
      }

      // Keyword validator starting with $
      if (validatorSpec.startsWith('$')) {
        const keyword = validatorSpec.slice(1);
        const validator = this.get(keyword);

        if (!validator) {
          throw new ValidatorError(`Unknown validator keyword: ${validatorSpec}`);
        }

        // Wrap to ensure async
        return async (value) => await validator(value);
      }

      // Plain string - treat as exact match
      return async (value) => {
        if (String(value) !== validatorSpec) {
          throw new ValidatorError(`Value must be exactly "${validatorSpec}"`);
        }
        return value;
      };
    }

    // Object-based validators -- todo rewrite as registered validators
    if (typeof validatorSpec === 'object' && validatorSpec !== null) {
      return this._createObjectValidator(validatorSpec);
    }

    throw new ValidatorError(`Invalid validator specification: ${validatorSpec}`);
  }

  /**
   * Execute validator and return standardized result
   * @param {Function} validator - Validation function
   * @param {*} value - Value to validate
   * @param {string} fieldName - Field name for error context
   * @returns {Promise<true|string>} Promise resolving to true if valid, error message if invalid
   */
  async executeValidator(validator, value, fieldName = 'field') {
    try {
      return await validator(value);
    }
    catch (error) {
      throw new ValidatorError(`${fieldName} validation failed: ${error.message}`, {cause:error});
    }
  }

  /**
   * Register built-in validators
   * @private
   */
  _registerBuiltInValidators() {
    // Synchronous validators
    this.register('hostname', (value) => {
      const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

      if (!hostnameRegex.test(value)) {
        throw new ValidatorError('Invalid hostname format');
      }
      return value;
    });

    this.register('url', (value) => {
      try {
        return new URL(value).toString();
      } catch {
        throw new ValidatorError('Invalid URL format');
      }
    });

    this.register('email', (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new ValidatorError('Invalid email format');
      }
      return value;
    });

    this.register('port', (value) => {
      const num = Number(value);
      if (!(Number.isInteger(num) && num >= 1 && num <= 65535)) {
        throw new ValidatorError('Port must be between 1 and 65535');
      }
      return num;
    });

    this.register('ipv4', (value) => {
      const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
      if (!ipv4Regex.test(value)) {
        throw new ValidatorError('Invalid IPv4 address');
      }
      return value;
    });

    this.register('ipv6', (value) => {
      const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
      if (!ipv6Regex.test(value)) {
        throw new ValidatorError('Invalid IPv6 address');
      }
      return value;
    });

    this.register('uuid', (value) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) {
        throw new ValidatorError('Invalid UUID format');
      }
      return value;
    });

    this.register('alphanum', (value) => {
      const alphanumRegex = /^[a-zA-Z0-9]+$/;
      if (!alphanumRegex.test(value)) {
        throw new ValidatorError('Must contain only alphanumeric characters');
      }
      return value;
    });

    this.register('alpha', (value) => {
      const alphaRegex = /^[a-zA-Z]+$/;
      if (!alphaRegex.test(value)) {
        throw new ValidatorError('Must contain only letters');
      }
      return value;
    });

    this.register('number', (value) => {
      const num = Number(value);
      if (Number.isNaN(num) || !Number.isFinite(num)) {
        throw new ValidatorError('Must be a number');
      }
      return num;
    })
    this.register('numeric', (value) => {
      let v = `${value}`

      const numericRegex = /^[0-9]+$/;
      if (!numericRegex.test(v)) {
        throw new ValidatorError('Must contain only digits');
      }
      return value;
    });

    this.register('nonempty', (value) => {
      if (!(value && value.toString().trim().length > 0)) {
        throw new ValidatorError('Value cannot be empty');
      }
      return value;
    });

    this.register('positive', (value) => {
      const num = Number(value);
      if (!(Number.isFinite(num) && num > 0)) {
        throw new ValidatorError('Must be a positive number');
      }
      return num;
    });

    this.register('negative', (value) => {
      const num = Number(value);
      if (!(Number.isFinite(num) && num < 0)) {
        throw new ValidatorError('Must be a negative number');
      }
      return num;
    });

    this.register('integer', (value) => {
      const num = Number(value);
      if (!Number.isInteger(num)) {
        throw new ValidatorError('Must be an integer');
      }
      return num;
    });

    // Asynchronous validators for file system operations
    this.register('file', async (value) => {
      try {
        const stat = await fs.stat(value);
        if (!stat.isFile()) {
          throw new ValidatorError('Path exists but is not a file');
        }
        return value;
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new ValidatorError('File does not exist');
        }
        throw new ValidatorError(`Cannot access file: ${error.message}`);
      }
    });

    this.register('directory', async (value) => {
      try {
        const stat = await fs.stat(value);
        if (!stat.isDirectory()) {
          throw new ValidatorError('Path exists but is not a directory');
        }
        return value;
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new ValidatorError('Directory does not exist');
        }
        throw new ValidatorError(`Cannot access directory: ${error.message}`);
      }
    });

    this.register('readable', async (value) => {
      try {
        await fs.access(value, constants.R_OK);
        return value;
      } catch {
        throw new ValidatorError('File is not readable');
      }
    });

    this.register('writable', async (value) => {
      try {
        await fs.access(value, constants.W_OK);
        return value;
      } catch {
        throw new ValidatorError('File is not writable');
      }
    });

    // Async network validators
    this.register('reachable', async (value) => {
      try {
        await lookup(value);
        return value;
      } catch {
        throw new ValidatorError('Host is not reachable');
      }
    });

    this.register('httpurl', async (value) => {
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new ValidatorError('URL must use HTTP or HTTPS protocol');
        }

        // Optional: Actually test the URL
        // const response = await fetch(value, { method: 'HEAD' });
        // if (!response.ok) throw new ValidatorError(`HTTP error: ${response.status}`);

        return value;
      } catch (error) {
        if (error.message.includes('URL must use HTTP')) {
          throw error;
        }
        throw new ValidatorError('Invalid HTTP URL format');
      }
    });
  }

  /**
   * Create validator function from object specification
   * @param {Object} spec - Object validator specification
   * @returns {Function} Async validation function
   * @private
   */
  _createObjectValidator(spec) {
    const keys = Object.keys(spec);
    if (keys.length !== 1) {
      throw new ValidatorError('Validator object must have exactly one key');
    }

    const [keyword] = keys;
    const args = spec[keyword];

    switch (keyword) {
      case '$and':
        if (!Array.isArray(args)) {
          throw new ValidatorError('$and validator requires an array of validators');
        }
        const andValidators = args.map(v => this.getValidatorFunction(v));
        return async (value) => {
          let v = value;
          for (const validator of andValidators) {
            v = await this.executeValidator(validator, v);
          }
          return v;
        };

      case '$or':
        if (!Array.isArray(args)) {
          throw new ValidatorError('$or validator requires an array of validators');
        }
        const orValidators = args.map(v => this.getValidatorFunction(v));
        return async (value) => {
          let v = value;
          const errors = [];
          for (const validator of orValidators) {
            try {
              v = await this.executeValidator(validator, v);
              return v;
            } catch (error) {
              errors.push(error.message);
            }
          }
          throw new ValidatorError(`None of the alternatives matched: ${errors.join(', ')}`);
        };

      case '$not':
        const notValidator = this.getValidatorFunction(args);
        return async (value) => {
          try {
            await this.executeValidator(notValidator, value);
          } catch (error) {
            // For $not, a validation error is a success
            return value;
          }
          throw new ValidatorError('Value must not match the specified condition');
        };

      case '$length':
        if (typeof args !== 'object' || args === null) {
          throw new ValidatorError('$length validator requires an object with min/max properties');
        }
        const { min, max, exact } = args;
        return async (value) => {
          const length = String(value).length;
          if (exact !== undefined && length !== exact) {
            throw new ValidatorError(`Length must be exactly ${exact} characters`);
          }
          if (min !== undefined && length < min) {
            throw new ValidatorError(`Length must be at least ${min} characters`);
          }
          if (max !== undefined && length > max) {
            throw new ValidatorError(`Length must be at most ${max} characters`);
          }
          return value;
        };

      case '$range':
        if (typeof args !== 'object' || args === null) {
          throw new ValidatorError('$range validator requires an object with min/max properties');
        }
        const { min: minVal, max: maxVal } = args;
        return async (value) => {
          const num = Number(value);
          if (!Number.isFinite(num)) {
            throw new ValidatorError('Value must be a number');
          }
          if (minVal !== undefined && num < minVal) {
            throw new ValidatorError(`Value must be at least ${minVal}`);
          }
          if (maxVal !== undefined && num > maxVal) {
            throw new ValidatorError(`Value must be at most ${maxVal}`);
          }
          return value;
        };

      case '$in':
        if (!Array.isArray(args)) {
          throw new ValidatorError('$in validator requires an array of allowed values');
        }
        return async (value) => {
          if (!args.includes(value)) {
            throw new ValidatorError(`Value must be one of: ['${args.join('\', \'')}']`);
          }
          return value;
        };

      case '$each':
        const validatorFunction = this.getValidatorFunction(args);
        return async (value) => {
          if (!Array.isArray(value)) {
            throw new ValidatorError('Value must be an array');
          }
          for (const item of value) {
            await this.executeValidator(validatorFunction, item);
          }
          return value;
        }

      default:
        // Check if it's a registered validator with arguments
        if (keyword.startsWith('$')) {
          const validatorName = keyword.slice(1);
          const validator = this.get(validatorName);

          if (validator) {
            return async (value) => await validator(value)
          }
        }

        throw new ValidatorError(`Unknown validator keyword: ${keyword}`);
    }
  }
}


