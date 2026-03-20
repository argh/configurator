// Simple constraints
import { IS_NUMBER_CONSTRAINT } from './is-number-constraint.js';
import { IS_STRING_CONSTRAINT } from './is-string-constraint.js';
import { IS_ARRAY_CONSTRAINT } from './is-array-constraint.js';
import { IS_OBJECT_CONSTRAINT } from './is-object-constraint.js'
import { IS_DATE_CONSTRAINT } from './is-date-constraint.js';

import { HOSTNAME_CONSTRAINT } from './hostname-constraint.js';
import { URL_CONSTRAINT } from './url-constraint.js';
import { EMAIL_CONSTRAINT } from './email-constraint.js';
import { PORT_CONSTRAINT } from './port-constraint.js';
import { IPV4_CONSTRAINT } from './ipv4-constraint.js';
import { IPV6_CONSTRAINT } from './ipv6-constraint.js';
import { UUID_CONSTRAINT } from './uuid-constraint.js';
import { ALPHANUM_CONSTRAINT } from './alphanum-constraint.js';
import { ALPHA_CONSTRAINT } from './alpha-constraint.js';

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
import { TRUTHY_CONSTRAINT } from './truthy-constraint.js';

// Simple operators
import { NUMBER_OPERATOR } from './number-operator.js';
import { STRING_OPERATOR } from './string-operator.js';
import { ARRAY_OPERATOR } from './array-operator.js';
import { OBJECT_OPERATOR } from './object-operator.js'
import { DATE_OPERATOR } from './date-operator.js';
import { TRIM_OPERATOR } from './trim-operator.js';
import { LOWERCASE_OPERATOR } from './lowercase-operator.js';
import { UPPERCASE_OPERATOR } from './uppercase-operator.js';
import { CAMELCASE_OPERATOR } from './camelcase-operator.js';
import { PASCALCASE_OPERATOR } from './pascalcase-operator.js';
import { KEBABCASE_OPERATOR } from './kebabcase-operator.js';
import { CONSTANTCASE_OPERATOR } from './constantcase-operator.js';
import { HEADLINE_OPERATOR } from './headline-operator.js';

// Parameterized processors
import { FILESIZE_CONSTRAINT } from './filesize-constraint.js';
import { AND_CONSTRAINT } from './build-sequence-processors.js';
import { OR_CONSTRAINT } from './build-sequence-processors.js';
import { NOT_CONSTRAINT } from './build-not-constraint.js';
import { RANGE_CONSTRAINT } from './range-constraint.js';
import { LENGTH_CONSTRAINT } from './length-constraint.js';
import { IN_CONSTRAINT } from './build-in-constraint.js';
import { EACH_OPERATOR } from './build-each-operator.js';
import { ROUND_OPERATOR } from './round-operator.js';
import { CEIL_OPERATOR } from './ceil-operator.js';
import { FLOOR_OPERATOR } from './floor-operator.js';
import { FILTER_OPERATOR } from './build-filter-operator.js';
import { PIPELINE_OPERATOR } from './build-pipeline-operator.js';
import { PROPERTY_OPERATOR } from './property-operator.js';
import { REFERENCE_OPERATOR } from './reference-operator.js';
import { DEFINED_CONSTRAINT } from './defined-constraint.js';
import { FIRST_OPERATOR } from './build-sequence-processors.js';
import { EQ_CONSTRAINT } from './eq-constraint.js';
import { ANY_CONSTRAINT } from './build-sequence-processors.js';
import { ALL_CONSTRAINT } from './build-sequence-processors.js';
import { ASSERT_CONSTRAINT } from './build-assert-constraint.js';
import { IF_OPERATOR } from './build-conditional-operators.js';
import { GATE_OPERATOR } from './build-conditional-operators.js';
import { CHECK_OPERATOR } from './build-conditional-operators.js';
import { WHEN_OPERATOR } from './build-conditional-operators.js';
import { TRY_OPERATOR } from './build-conditional-operators.js';
import { PREFIX_CONSTRAINT } from "./prefix-constraint.js";
import { SUFFIX_CONSTRAINT } from "./suffix-constraint.js";
import { REQUIRE_CONSTRAINT } from './build-require-constraint.js';
import { NEVER_CONSTRAINT } from './build-never-constraint.js';
import { JOIN_OPERATOR } from './join-operator.js';
import { SPLIT_OPERATOR } from './split-operator.js';
import { PARALLEL_OPERATOR } from './build-parallel-operator.js';
import { PROCESS_OPERATOR } from './process-operator.js';
import { COMPILE_OPERATOR } from './build-compile-operator.js';
import { KEYS_OPERATOR } from './keys-operator.js';
import { VALUES_OPERATOR } from './values-operator.js';
import { ENTRIES_OPERATOR } from './entries-operator.js';
import { PICK_OPERATOR } from './pick-operator.js';
import { OMIT_OPERATOR } from './omit-operator.js';
import { MERGE_OPERATOR } from './merge-operator.js';
import { GET_OPERATOR } from './get-operator.js';
import { LOOKUP_OPERATOR } from './lookup-operator.js';


/** @import { ValueProcessorDefinition } from '../value-processor/value-processor.js'; */

/**
 * Get all built-in value processor definitions
 * @returns {ValueProcessorDefinition[]}
 */
export function getBuiltinProcessors() {
  return [
    IS_STRING_CONSTRAINT,
    IS_OBJECT_CONSTRAINT,
    IS_NUMBER_CONSTRAINT,
    IS_ARRAY_CONSTRAINT,
    IS_DATE_CONSTRAINT,
    // Simple constraints
    DEFINED_CONSTRAINT,
    HOSTNAME_CONSTRAINT,
    URL_CONSTRAINT,
    EMAIL_CONSTRAINT,
    PORT_CONSTRAINT,
    IPV4_CONSTRAINT,
    IPV6_CONSTRAINT,
    UUID_CONSTRAINT,
    ALPHANUM_CONSTRAINT,
    ALPHA_CONSTRAINT,

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
    TRUTHY_CONSTRAINT,
    EQ_CONSTRAINT,

    // Simple operators
    ARRAY_OPERATOR,
    OBJECT_OPERATOR,
    NUMBER_OPERATOR,
    STRING_OPERATOR,
    DATE_OPERATOR,
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
    AND_CONSTRAINT,
    OR_CONSTRAINT,
    NOT_CONSTRAINT,
    RANGE_CONSTRAINT,
    LENGTH_CONSTRAINT,
    IN_CONSTRAINT,
    EACH_OPERATOR,
    ROUND_OPERATOR,
    CEIL_OPERATOR,
    FLOOR_OPERATOR,
    FILTER_OPERATOR,
    PROPERTY_OPERATOR,
    REFERENCE_OPERATOR,
    FIRST_OPERATOR,
    ANY_CONSTRAINT,
    ALL_CONSTRAINT,
    ASSERT_CONSTRAINT,
    IF_OPERATOR,
    GATE_OPERATOR,
    CHECK_OPERATOR,
    WHEN_OPERATOR,
    TRY_OPERATOR,
    PREFIX_CONSTRAINT,
    SUFFIX_CONSTRAINT,
    REQUIRE_CONSTRAINT,
    NEVER_CONSTRAINT,
    SPLIT_OPERATOR,
    JOIN_OPERATOR,
    PARALLEL_OPERATOR,
    PROCESS_OPERATOR,
    COMPILE_OPERATOR,
    KEYS_OPERATOR,
    VALUES_OPERATOR,
    ENTRIES_OPERATOR,
    PICK_OPERATOR,
    OMIT_OPERATOR,
    MERGE_OPERATOR,
    GET_OPERATOR,
    LOOKUP_OPERATOR,
  ];
}

// Export all processor definitions for TypeDoc documentation
// Note: These are exported for documentation purposes. In normal usage,
// processors are accessed via registry keywords (e.g., '$hostname') rather
// than by importing these definitions directly.
export {
  // Simple constraints
  IS_NUMBER_CONSTRAINT,
  IS_OBJECT_CONSTRAINT,
  IS_STRING_CONSTRAINT,
  IS_ARRAY_CONSTRAINT,
  IS_DATE_CONSTRAINT,
  DEFINED_CONSTRAINT,
  HOSTNAME_CONSTRAINT,
  URL_CONSTRAINT,
  EMAIL_CONSTRAINT,
  PORT_CONSTRAINT,
  IPV4_CONSTRAINT,
  IPV6_CONSTRAINT,
  UUID_CONSTRAINT,
  ALPHANUM_CONSTRAINT,
  ALPHA_CONSTRAINT,
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
  TRUTHY_CONSTRAINT,
  EQ_CONSTRAINT,

  // Simple operators
  NUMBER_OPERATOR,
  STRING_OPERATOR,
  ARRAY_OPERATOR,
  OBJECT_OPERATOR,
  DATE_OPERATOR,
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
  AND_CONSTRAINT,
  OR_CONSTRAINT,
  NOT_CONSTRAINT,
  RANGE_CONSTRAINT,
  LENGTH_CONSTRAINT,
  IN_CONSTRAINT,
  EACH_OPERATOR,
  ROUND_OPERATOR,
  CEIL_OPERATOR,
  FLOOR_OPERATOR,
  FILTER_OPERATOR,
  PROPERTY_OPERATOR,
  REFERENCE_OPERATOR,
  FIRST_OPERATOR,
  IF_OPERATOR,
  GATE_OPERATOR,
  CHECK_OPERATOR,
  WHEN_OPERATOR,
  TRY_OPERATOR,
  ASSERT_CONSTRAINT,
  PREFIX_CONSTRAINT,
  SUFFIX_CONSTRAINT,
  ANY_CONSTRAINT,
  ALL_CONSTRAINT,
  REQUIRE_CONSTRAINT,
  NEVER_CONSTRAINT,
  SPLIT_OPERATOR,
  JOIN_OPERATOR,
  PARALLEL_OPERATOR,
  PROCESS_OPERATOR,
  COMPILE_OPERATOR,
  KEYS_OPERATOR,
  VALUES_OPERATOR,
  ENTRIES_OPERATOR,
  PICK_OPERATOR,
  OMIT_OPERATOR,
  MERGE_OPERATOR,
  GET_OPERATOR,
  LOOKUP_OPERATOR,
};
