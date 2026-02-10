import assert from 'node:assert';
import { Schema, SchemaResolver } from '../src/index.js';

const resolver = new SchemaResolver();

// Recursive Schema with Dynamic Input
//
// This example defines a schema that describes an unbalanced binary tree of numbers.
// The left/right values are recursively defined using this same schema, so we need
// to first create the schema (to get a reference) and then add the left/right
// schema properties in a separate step.
//
// This example also demonstrates how the the output from the normalization process
// is traversed to populate child properties; here we leverage this to generate
// the entire child hierarchy dynamically.
//
// (This is a contrived example that is very slow due to every step of the process being async!)

const treeNodeSchema = new Schema('any')
  .property('value', new Schema('number').required())
  .normalizer(input => {
    if (Array.isArray(input) && input.length > 0) {
      const left = [];
      const right = [];
      const value = input[0];

      for (let i = 1; i < input.length; ++i) {
        if (input[i] < value) {
          left.push(input[i]);
        }
        else {
          right.push(input[i]);
        }
      }
      return {
        value,
        left: left.length? left : null,
        right: right.length? right : null
      }
    }
    else if (typeof input === 'object') {
      return input;
    }
    return null;
  })


treeNodeSchema
  .property('left', treeNodeSchema)
  .property('right', treeNodeSchema)

const schema = await resolver.compile(treeNodeSchema);

const input = Array.from({length: 100}, () => Math.floor(Math.random() * 100)) ;

const start = performance.now()
const tree = await schema.process(input, undefined, {debug: process.env.DEBUG==='true'});
const elapsed = performance.now() - start
console.log(`took ${elapsed.toFixed(2)}ms`)

// the sorted input array should be identical to a depth-first traversal of the tree:
function dft(node, out = []) {
  if (node) {
    dft(node.left, out);
    out.push(node.value);
    dft(node.right, out);
  }
  return out;
}
assert.deepStrictEqual(dft(tree), input.sort((a, b) => (a - b)));

console.log('lgtm!');
