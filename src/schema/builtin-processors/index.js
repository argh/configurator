// Simple constraints
import { HOSTNAME_CONSTRAINT } from './hostname-constraint.js';
import { URL_CONSTRAINT } from './url-constraint.js';
import { EMAIL_CONSTRAINT } from './email-constraint.js';
import { PORT_CONSTRAINT } from './port-constraint.js';
import { IPV4_CONSTRAINT } from './ipv4-constraint.js';
import { IPV6_CONSTRAINT } from './ipv6-constraint.js';
import { UUID_CONSTRAINT } from './uuid-constraint.js';
import { ALPHANUM_CONSTRAINT } from './alphanum-constraint.js';
import { ALPHA_CONSTRAINT } from './alpha-constraint.js';
import { NUMBER_CONSTRAINT } from './number-constraint.js';
import { NUMERIC_CONSTRAINT } from './numeric-constraint.js';
import { NONEMPTY_CONSTRAINT } from './nonempty-constraint.js';
import { POSITIVE_CONSTRAINT } from './positive-constraint.js';
import { NEGATIVE_CONSTRAINT } from './negative-constraint.js';
import { INTEGER_CONSTRAINT } from './integer-constraint.js';
import { JSON_CONSTRAINT } from './json-constraint.js';
import { BASE64_CONSTRAINT } from './base64-constraint.js';
import { HEX_CONSTRAINT } from './hex-constraint.js';
import { FILE_CONSTRAINT } from './file-constraint.js';
import { DIRECTORY_CONSTRAINT } from './directory-constraint.js';
import { READABLE_CONSTRAINT } from './readable-constraint.js';
import { WRITABLE_CONSTRAINT } from './writable-constraint.js';
import { EXECUTABLE_CONSTRAINT } from './executable-constraint.js';
import { REACHABLE_CONSTRAINT } from './reachable-constraint.js';
import { HTTPURL_CONSTRAINT } from './httpurl-constraint.js';

// Simple operators
import { TRIM_OPERATOR } from './trim-operator.js';
import { LOWERCASE_OPERATOR } from './lowercase-operator.js';
import { UPPERCASE_OPERATOR } from './uppercase-operator.js';
import { CAMELCASE_OPERATOR } from './camelcase-operator.js';
import { PASCALCASE_OPERATOR } from './pascalcase-operator.js';
import { KEBABCASE_OPERATOR } from './kebabcase-operator.js';
import { CONSTANTCASE_OPERATOR } from './constantcase-operator.js';
import { HEADLINE_OPERATOR } from './headline-operator.js';

// Parameterized processors
import { FILESIZE_CONSTRAINT } from './build-filesize-constraint.js';
import { AND_OPERATOR } from './build-and-operator.js';
import { OR_OPERATOR } from './build-or-operator.js';
import { NOT_OPERATOR } from './build-not-operator.js';
import { RANGE_CONSTRAINT } from './build-range-constraint.js';
import { LENGTH_CONSTRAINT } from './build-length-constraint.js';
import { IN_CONSTRAINT } from './build-in-constraint.js';
import { EACH_OPERATOR } from './build-each-operator.js';
import { ROUND_OPERATOR } from './build-round-operator.js';
import { CEIL_OPERATOR } from './build-ceil-operator.js';
import { FLOOR_OPERATOR } from './build-floor-operator.js';
import { FILTER_OPERATOR } from './build-filter-operator.js';
import { PIPELINE_OPERATOR } from './build-pipeline-operator.js';
import { PROPERTY_OPERATOR } from './build-property-operator.js';


/** @import { ValueProcessorDefinition } from '../types.js'; */


/**
 * Built-in value processors with simple process functions
 * Map of keyword -> processor definition
 */
export const SIMPLE_PROCESSORS = /** @type {Map<string, ValueProcessorDefinition>} */ new Map([
  ['hostname', HOSTNAME_CONSTRAINT],
  ['url', URL_CONSTRAINT],
  ['email', EMAIL_CONSTRAINT],
  ['port', PORT_CONSTRAINT],
  ['ipv4', IPV4_CONSTRAINT],
  ['ipv6', IPV6_CONSTRAINT],
  ['uuid', UUID_CONSTRAINT],
  ['alphanum', ALPHANUM_CONSTRAINT],
  ['alpha', ALPHA_CONSTRAINT],
  ['number', NUMBER_CONSTRAINT],
  ['numeric', NUMERIC_CONSTRAINT],
  ['nonempty', NONEMPTY_CONSTRAINT],
  ['positive', POSITIVE_CONSTRAINT],
  ['negative', NEGATIVE_CONSTRAINT],
  ['integer', INTEGER_CONSTRAINT],
  ['json', JSON_CONSTRAINT],
  ['base64', BASE64_CONSTRAINT],
  ['hex', HEX_CONSTRAINT],
  ['file', FILE_CONSTRAINT],
  ['directory', DIRECTORY_CONSTRAINT],
  ['readable', READABLE_CONSTRAINT],
  ['writable', WRITABLE_CONSTRAINT],
  ['executable', EXECUTABLE_CONSTRAINT],
  ['reachable', REACHABLE_CONSTRAINT],
  ['httpurl', HTTPURL_CONSTRAINT],
  ['trim', TRIM_OPERATOR],
  ['lowercase', LOWERCASE_OPERATOR],
  ['uppercase', UPPERCASE_OPERATOR],
  ['camelcase', CAMELCASE_OPERATOR],
  ['pascalcase', PASCALCASE_OPERATOR],
  ['kebabcase', KEBABCASE_OPERATOR],
  ['constantcase', CONSTANTCASE_OPERATOR],
  ['headline', HEADLINE_OPERATOR]
]);


/**
 * Built-in parameterized processors (require compilation)
 * Map of keyword -> processor definition
 */
export const PARAMETERIZED_PROCESSORS = /** @type {Map<string, ValueProcessorDefinition>} */ new Map([
  ['pipeline', PIPELINE_OPERATOR],
  ['filesize', FILESIZE_CONSTRAINT],
  ['and', AND_OPERATOR],
  ['or', OR_OPERATOR],
  ['not', NOT_OPERATOR],
  ['range', RANGE_CONSTRAINT],
  ['length', LENGTH_CONSTRAINT],
  ['in', IN_CONSTRAINT],
  ['each', EACH_OPERATOR],
  ['round', ROUND_OPERATOR],
  ['ceil', CEIL_OPERATOR],
  ['floor', FLOOR_OPERATOR],
  ['filter', FILTER_OPERATOR],
  ['property', PROPERTY_OPERATOR]
]);
