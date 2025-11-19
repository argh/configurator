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
 * Get all built-in value processor definitions
 * @returns {ValueProcessorDefinition[]}
 */
export function getBuiltinProcessors() {
  return [
    // Simple constraints
    HOSTNAME_CONSTRAINT,
    URL_CONSTRAINT,
    EMAIL_CONSTRAINT,
    PORT_CONSTRAINT,
    IPV4_CONSTRAINT,
    IPV6_CONSTRAINT,
    UUID_CONSTRAINT,
    ALPHANUM_CONSTRAINT,
    ALPHA_CONSTRAINT,
    NUMBER_CONSTRAINT,
    NUMERIC_CONSTRAINT,
    NONEMPTY_CONSTRAINT,
    POSITIVE_CONSTRAINT,
    NEGATIVE_CONSTRAINT,
    INTEGER_CONSTRAINT,
    JSON_CONSTRAINT,
    BASE64_CONSTRAINT,
    HEX_CONSTRAINT,
    FILE_CONSTRAINT,
    DIRECTORY_CONSTRAINT,
    READABLE_CONSTRAINT,
    WRITABLE_CONSTRAINT,
    EXECUTABLE_CONSTRAINT,
    REACHABLE_CONSTRAINT,
    HTTPURL_CONSTRAINT,

    // Simple operators
    TRIM_OPERATOR,
    LOWERCASE_OPERATOR,
    UPPERCASE_OPERATOR,
    CAMELCASE_OPERATOR,
    PASCALCASE_OPERATOR,
    KEBABCASE_OPERATOR,
    CONSTANTCASE_OPERATOR,
    HEADLINE_OPERATOR,

    // Parameterized processors
    PIPELINE_OPERATOR,
    FILESIZE_CONSTRAINT,
    AND_OPERATOR,
    OR_OPERATOR,
    NOT_OPERATOR,
    RANGE_CONSTRAINT,
    LENGTH_CONSTRAINT,
    IN_CONSTRAINT,
    EACH_OPERATOR,
    ROUND_OPERATOR,
    CEIL_OPERATOR,
    FLOOR_OPERATOR,
    FILTER_OPERATOR,
    PROPERTY_OPERATOR
  ];
}
