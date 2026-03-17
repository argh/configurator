import assert from 'node:assert';
import { Schema, SchemaResolver } from '../src/index.js';
import { ConstraintError, ValidationError } from '../src/schema/schema-errors.js';
import { AssertionError } from 'node:assert/strict';

const resolver = new SchemaResolver();

// This example demonstrates the use of conditionals and logic in value processor pipelines.
//
// Value processors generally fall into two categories: operators and constraints.
//
// Operators take an input value and return an output value.  They're most useful in normalizer and transformer
// handlers.

// Constraints take an input value, check it matches a condition, and either return it, or throw an exception.
// They are most useful in validator handlers, but are also often used in normalizer handlers to check inputs.
//
// However, both can be combined arbitrarily by wrapping them in other value processors that convert their behavior;
// Built-ins like `$require` and `$assert` can convert the behavior of operators into constraints.  Branching
// conditionals like `$if`, `$gate`, `$check`, `$when`, and `$try` all convert failed constraints to undefined,
// and allow different processing for success and failure.  And of course, you can always provide your own
// value processor that acts in either manner.

// Let's first take a look at some examples of logical operators and constraints.

// Most built-ins are constraints.

// Here's a little schema that validates http/https URLs:

const goodSchema1 = await resolver.compile(
  new Schema('object')
    .property('url', new Schema('string')
      .validator({$all: ['$url', {$any: [{$prefix: 'http:'}, {$prefix: 'https:'}]}]})
    )
)

// Little helper to check that we did in fact get back a url:
async function expectUrlPasses(schema, url) {
  const result = await schema.process({url});
  if (url !== result?.url) {
    if (typeof result?.url !== 'string' || new URL(url).toString() !== result?.url) {
      assert.fail(`Oops, maybe not a url, got back "${result?.url}" instead`);
    }
  }
  return result;
}
// A helper for when we're expecting a failure
async function expectUrlFails(schema, url) {
  try {
    const result = await schema.process({url});
    assert.fail(`Expected validation error but got back "${result?.url}" instead`);
  }
  catch (error) {
    // ignore, this is expected.
  }
}

// Given our schema, these should work:
await expectUrlPasses(goodSchema1, 'http://localhost');
await expectUrlPasses(goodSchema1, 'https://www.google.com');

// And these shouldn't:
await expectUrlFails(goodSchema1, 'not-a-url');
await expectUrlFails(goodSchema1, 'mailto:user@domain.com');

// Here's a similar looking schema, but it has a problem.  The provided validator function returns a boolean,
// a value type that isn't valid for this schema!
const badSchema1 = await resolver.compile(
  new Schema('object')
    .property('url', new Schema('string')
      .validator('$url')
      .validator((value) => value.startsWith('http:') || value.startsWith('https:'))
    )
)
// Oops, validator pipeline returned "true", which is not a url/string!
await expectUrlFails(badSchema1, 'https://www.google.com');

// Validators should instead just pass through (or improve) valid values, and throw when something is invalid.
// Since simple functions are useful for checking validity, one solution is to wrap the function in a constraint
// like `$assert` which will return the original input if a provided processor (the function, in this case)
// returns a truthy value:
const okSchema1 = await resolver.compile(
  new Schema('object')
    .property('url', new Schema('string')
      .validator('$url')
      .validator({$assert: ((value) => value.startsWith('http:') || value.startsWith('https:'))})
    )
)
await expectUrlPasses(okSchema1, 'https://www.google.com');

// Alternatively, you could implement the validation logic as a full constraint instead, but it's more verbose:
const okSchema2 = await resolver.compile(
  new Schema('object')
    .property('url', new Schema('string')
      .validator('$url')
      .validator((value) => {
          if (value.startsWith('http:') || value.startsWith('https:')) {
            return value;
          }
          throw new ConstraintError('URL must start with http: or https:');
        }
      )
    )
);
await expectUrlPasses(okSchema2, 'https://www.google.com');

// Processors like `$if`, `$gate`, `$assert`, and `$require` process values in supplied processors but return
// the original input on success.  This allows you to apply conditional operations or constraints that operate
// on transformed values without altering the original input.
//
// Here we will run a pipeline to extract the protocol and use the `$in` constraint to check it is either http or https.
// Wrapping it in `$require`
const okSchema3 = await resolver.compile(
  new Schema('object')
    .property('url', new Schema('string')
      .validator('$url')
      .validator({$require: {
            $pipeline: [
              (value => value.slice(0, value.indexOf(':'))),
              {$in: ['http', 'https']}
            ]}}
      )
    )
);
await expectUrlPasses(okSchema3, 'https://www.google.com');
await expectUrlFails(okSchema3, 'mailto:user@domain.com');



const base = new Schema('any')
  .default(true)
  .normalizer({$reference: 'input'})


function isPositive(v) {
  if (v === 666) {
    throw 'not today';
  }
  return v >= 0;
}

const schemas = new Map();

for (const conditional of ['$if', '$gate', '$check', '$when', '$try']) {

  schemas.set(conditional, await resolver.compile(new Schema('object')
    .property('input', new Schema('number'))
    .property('p1', new Schema(base)
      .transformer(conditional)
    )
    .property('p2', new Schema(base)
      .transformer({[conditional]: {predicate: isPositive}})
    )
    .property('p3', new Schema(base)
      .transformer({[conditional]: {predicate: isPositive, success: 'yes'}})
    )
    .property('p4', new Schema(base)
      .transformer({[conditional]: {predicate: isPositive, failure: 'no'}})
    )
    .property('p5', new Schema(base)
      .transformer({[conditional]: {predicate: isPositive, success: 'yes', failure: 'no'}})
    )
    .property('p6', new Schema(base)
      .transformer({[conditional]: {predicate: isPositive, success: s => s, failure: f => f }})
    )
  ));
}

const one = {input: 1};
const minus_one = {input: -1};
const zero = {input: 0};
const bad = {input: 666};



// $if interprets the "truthiness" of the predicate
// - on truthy, passes input to success ("then") action (default: return input)
// - on falsey/error/rejection, passes input to failure ("else") action (default: return undefined)

const s_$if = schemas.get('$if');
const v_$if_one = await s_$if.process(one)
assert.deepEqual(v_$if_one, {input: 1, p1: 1, p2: 1, p3: 'yes', p4: 1, p5: 'yes', p6: 1});
const v_$if_minus_one = await s_$if.process(minus_one);
assert.deepEqual(v_$if_minus_one, {input: -1, p1: -1, p4: 'no', p5: 'no', p6: -1});
const v_$if_zero = await s_$if.process(zero);
assert.deepEqual(v_$if_zero, {input: 0, p2: 0, p3: 'yes', p4: 0, p5: 'yes', p6: 0});
const v_$if_bad = await s_$if.process(bad);
assert.deepEqual(v_$if_bad, {input: 666, p1: 666, p4: 'no', p5: 'no', p6: 666});

// The most common main use case for $if is when you want to check the value using a function that returns true/false,
// and want to process the input differently depending on the result.

const distanceSchema = new Schema('number')
  .normalizer({$if: [{$pipeline: [{$reference: 'units'}, {$eq: 'feet'}]}, v => (v * 0.3048), v => (v * 1)]})

const s_$if_rationale = await resolver.compile(
  new Schema('object')
    .property('units', new Schema('string')
      .default('meters')
      .values(['meters', 'feet'])
    )
    .property('length', new Schema(distanceSchema))
    .property('width', new Schema(distanceSchema))
)

assert.deepEqual(await s_$if_rationale.process({units: 'meters', length: 10, width: 5}), {units: 'meters', length: 10, width: 5});
assert.deepEqual(await s_$if_rationale.process({units: 'feet', length: 10, width: 5}), {units: 'feet', length: 3.048, width: 1.524});

// $gate interprets whether the predicate "succeeded" (returned "something")
// - on a defined value, passes input to success action (default: return input)
// - on undefined/error/rejection, passes input to failure action (default: return undefined)

const s_$gate = schemas.get('$gate');
const v_$gate_one = await s_$gate.process(one)
assert.deepEqual(v_$gate_one, {input: 1, p1: 1, p2: 1, p3: 'yes', p4: 1, p5: 'yes', p6: 1});
const v_$gate_minus_one = await s_$gate.process(minus_one);
assert.deepEqual(v_$gate_minus_one, {input: -1, p1: -1, p2: -1, p3: 'yes', p4: -1, p5: 'yes', p6: -1});
const v_$gate_zero = await s_$gate.process(zero);
assert.deepEqual(v_$gate_zero, {input: 0, p1: 0, p2: 0, p3: 'yes', p4: 0, p5: 'yes', p6: 0});
const v_$gate_bad = await s_$gate.process(bad);
assert.deepEqual(v_$gate_bad, {input: 666, p1: 666, p4: 'no', p5: 'no', p6: 666});

// $check interprets whether the predicate is "truthy", but passes on the predicate results
// - if truthy value, passes predicate results to success action (default: return predicate results)
// - on falsey/error/rejection, passes input to failure action (default: return undefined)

const s_$check = schemas.get('$check');
const v_$check_one = await s_$check.process(one)
assert.deepEqual(v_$check_one, {input: 1, p1: true, p2: true, p3: 'yes', p4: true, p5: 'yes', p6: true});
const v_$check_minus_one = await s_$check.process(minus_one);
assert.deepEqual(v_$check_minus_one, {input: -1, p1: -1, p4: 'no', p5: 'no', p6: false});
const v_$check_zero = await s_$check.process(zero);
assert.deepEqual(v_$check_zero, {input: 0, p2: true, p3: 'yes', p4: true, p5: 'yes', p6: true});
const v_$check_bad = await s_$check.process(bad);
assert.deepEqual(v_$check_bad, {input: 666, p1: 666, p4: 'no', p5: 'no'});  // caught exception means predicate returns undefined!

// $when interprets whether the predicate completed or generated an error/rejection
// - if completed, passes predicate results to success action (default: return predicate results)
// - on error/rejection, passes results to failure action (default: return undefined)

const s_$when = schemas.get('$when');
const v_$when_one = await s_$when.process(one)
assert.deepEqual(v_$when_one, {input: 1, p1: 1, p2: true, p3: 'yes', p4: true, p5: 'yes', p6: true});
const v_$when_minus_one = await s_$when.process(minus_one);
assert.deepEqual(v_$when_minus_one, {input: -1, p1: -1, p2: false, p3: 'yes', p4: false, p5: 'yes', p6: false});
const v_$when_zero = await s_$when.process(zero);
assert.deepEqual(v_$when_zero, {input: 0, p1: 0, p2: true, p3: 'yes', p4: true, p5: 'yes', p6: true});
const v_$when_bad = await s_$when.process(bad);
assert.deepEqual(v_$when_bad, {input: 666, p1: 666, p4: 'no', p5: 'no'});  // caught exception means predicate returns undefined!

// $try interprets whether the predicate completed or generated an error/rejection
// - if completed, passes predicate results to success action (default: return predicate results)
// - on error/rejection, passes the error itself to the failure action (default: return undefined)

const s_$try = schemas.get('$try');
const v_$try_one = await s_$try.process(one)
assert.deepEqual(v_$try_one, {input: 1, p1: 1, p2: true, p3: 'yes', p4: true, p5: 'yes', p6: true});
const v_$try_minus_one = await s_$try.process(minus_one);
assert.deepEqual(v_$try_minus_one, {input: -1, p1: -1, p2: false, p3: 'yes', p4: false, p5: 'yes', p6: false});
const v_$try_zero = await s_$try.process(zero);
assert.deepEqual(v_$try_zero, {input: 0, p1: 0, p2: true, p3: 'yes', p4: true, p5: 'yes', p6: true});
const v_$try_bad = await s_$try.process(bad);
assert.deepEqual(v_$try_bad, {input: 666, p1: 666, p4: 'no', p5: 'no', p6: 'not today'});  // caught exception means predicate returns undefined!

// Observe that you can also directly use the conditionals as pipeline operators

const pipe = await resolver.compile(
  new Schema('number')
    .transformer(v => v - 2)
    .transformer('$check')
)

const v_pipe_4 = await pipe.process(4);
assert(v_pipe_4 === 2);

const v_pipe_2 = await pipe.process(2);
assert(v_pipe_2 === undefined);  // 0 is not truthy; default failure action is to return undefined

// It is important to understand the difference between logical operators and logical constraints:

const logicalOperatorSchema = resolver.compile(
  new Schema('number')
    .transformer({$or: []})
)






console.log('lgtm!');


