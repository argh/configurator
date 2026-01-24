// example for docs

import { Schema, SchemaResolver } from '../src/index.js';

class Final {
  #stuff = {}

  get stuff() {
    return this.#stuff;
  }

  set stuff(value) {
    throw new Error('assignment disallowed!')
  }
}

const srcSchema = new Schema('object')
  .transformer(() => new Final())
  .property('stuff',
    new Schema('object')
      .implicit()
      .property('*', new Schema())
  );

const resolver = new SchemaResolver();
const compiledSchema = await resolver.compile(srcSchema);

const result = await compiledSchema.process({stuff: {a: 1, b: 2}});

console.log(result);
