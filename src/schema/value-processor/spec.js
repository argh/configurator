
/** @import { ValueProcessorSpec, KeywordValueProcessorSpec } from './value-processor.js' */

import { isPlainObject } from '../../utils.js';
import { ValueProcessor } from './value-processor.js';
import { SchemaError } from '../schema-errors.js';

/**
 * @param {ValueProcessorSpec} spec
 * @returns {spec is KeywordValueProcessorSpec}
 * @package
 */
export function isKeywordValueProcessorSpec(spec) {

  if (typeof spec === 'string' && spec.charAt(0) === '$') {
    return true;
  }
  if (typeof spec === 'object' && spec !== null) {
    const keys = Object.keys(spec);
    if (keys.length === 1 && keys[0].charAt(0) === '$') {
      return true;
    }
  }
  return false;
}

/**
 * @param {KeywordValueProcessorSpec} keywordSpec
 * @returns {[string,any]}
 * @package
 */
export function extractKeywordValueProcessorSpec(keywordSpec) {
  let keyword;
  let args = [];
  if (typeof keywordSpec === 'string' && (keywordSpec.charAt(0) === '$')) {
    keyword = keywordSpec.slice(1);
  }
  else if (typeof keywordSpec === 'object' && keywordSpec !== null) {
    const keys = Object.keys(keywordSpec);

    if (keys.length === 1 && keys[0].charAt(0) === '$') {
      keyword = keys[0].slice(1);
      args = keywordSpec[keys[0]];
    }
  }

  if (!keyword) {
    throw new SchemaError('Not a keyword operation');
  }

  return [keyword, args];
}

/**
 * Check whether a candidate spec is legal
 * @param {any} spec
 * @returns {boolean}
 * @package
 */
export function isLegalValueProcessorSpec(spec) {
  if (spec === null || spec === undefined) {
    return false;
  }
  if (spec instanceof ValueProcessor) {
    return true;
  }
  if (Array.isArray(spec)) {
    for (let s = 0; s < spec.length; ++s) {
      if (!isLegalValueProcessorSpec(spec[s])) {
        return false;
      }
    }
    return true;
  }
  if (isPlainObject(spec)) {
    let dollar = 0;
    for (const key of Object.keys(spec)) {
      if (key.charAt(0) === '$') {
        dollar++
      }
      if (dollar > 1) {
        return false;
      }
      if (key !== '$literal' && !isLegalValueProcessorSpec(spec[key])) {
        return false;
      }
    }
    return true;
  }
  return true;
}