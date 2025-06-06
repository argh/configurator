# Validator Tests

This directory contains tests for the `Validator` class, specifically focusing on the `validate()` method with various validator specifications.

## Test Structure

- `validator-0.test.js` - Basic validation tests covering different validator specification types
- `validator-1-complex.test.js` - Complex validation scenarios with combined validators
- `validator-2-edge-cases.test.js` - Edge cases and error handling tests

## Running Tests

To run the tests, use the following command:

```bash
npm test
```

This will run all tests using Mocha.

## Test Coverage

The tests cover the following validator specifications:

1. Function validators
2. RegExp validators
3. String pattern validators
4. String exact match validators
5. Built-in validators ($email, $hostname, $url, etc.)
6. Object-based validators:
   - $length (min, max, exact)
   - $range (min, max)
   - $oneof (array of allowed values)
   - $and (array of validators, all must pass)
   - $or (array of validators, at least one must pass)
   - $not (negates the result of a validator)
   - $custom (custom validation function)

The tests also cover edge cases and error handling scenarios.
