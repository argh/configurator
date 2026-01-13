import { ConstraintError } from '../../errors.js';

/**
 * **Processor**: `$uuid`
 *
 * Validates that a string matches valid UUID format (versions 1-5).
 * UUIDs must follow RFC 4122 format: 8-4-4-4-12 hexadecimal digits
 * separated by hyphens.
 *
 * @example
 * ```javascript
 * // Basic usage
 * Schema.create('string').validator('$uuid')
 *
 * // In a schema property
 * Schema.create('object', {
 *   requestId: Schema.create('string').validator('$uuid'),
 *   sessionToken: Schema.create('string').validator('$uuid')
 * })
 *
 * // Combined with other validation
 * Schema.create('string')
 *   .validator('$nonempty')
 *   .validator('$uuid')
 * ```
 *
 * **Valid values**:
 * - `550e8400-e29b-41d4-a716-446655440000` (v4)
 * - `6ba7b810-9dad-11d1-80b4-00c04fd430c8` (v1)
 * - `3d813cbb-47fb-32ba-91df-831e1593ac29` (v3)
 * - `A6EAFB30-E49B-51D4-9B1D-8F6C0F89E8B3` (case-insensitive)
 *
 * **Invalid values**:
 * - `550e8400-e29b-41d4-a716` (too short)
 * - `550e8400e29b41d4a716446655440000` (missing hyphens)
 * - `550e8400-e29b-61d4-a716-446655440000` (invalid version digit)
 * - `not-a-valid-uuid-string`
 *
 * @type {import('../types.js').ValueProcessorDefinition}
 */
export const UUID_CONSTRAINT = {
  keyword: 'uuid',
  processor: (value) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new ConstraintError('Invalid UUID format');
    }
    return value;
  }
};
