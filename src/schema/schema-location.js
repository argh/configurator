import { CompiledSchema } from "./compiled-schema.js";
import { behead } from '../utils.js';

export class SchemaLocation {

  /** @type {Map<string,SchemaLocation>} */
  #children = new Map();

  /** @type {SchemaLocation|undefined} */
  #parent

  /** @type {CompiledSchema} */
  #schema;

  /** @type {string} */
  #path;
  /**
   * @param {CompiledSchema} schema
   * @param {SchemaLocation} [parent]
   * @param {string} [propertyName]
   */
  constructor(schema, parent, propertyName) {
    this.#schema = schema;
    if (parent !== undefined && propertyName !== undefined) {
      this.#parent = parent;
      this.#path = parent.path ? `${parent.path}.${propertyName}` : `${propertyName}`;
    }
    else {
      this.#path = '';
    }
  }

  /** @type {string} */
  get path() {
    return this.#path;
  }

  toString() {
    return this.#path;
  }

  /** @type {string} */
  get name() {
    const dot = this.#path.lastIndexOf('.');
    return (dot === -1)? this.#path : this.#path.slice(dot + 1);
  }

  /** @type {CompiledSchema} */
  get schema() {
    return this.#schema;
  }
  set schema(schema) {
    if (schema === undefined || schema === this.#schema) {
      return;
    }
    for (const [propertyName, propertyLocation] of this.#children) {
      const propertySchema = schema.getPropertySchema(propertyName);

      if (propertySchema !== undefined) {
        propertyLocation.schema = propertySchema;
      }
      else {
        this.#children.delete(propertyName);
      }
    }
    this.#schema = schema;
  }

  /** @type {SchemaLocation|undefined} */
  get parent() {
    return this.#parent;
  }

  /** @type {SchemaLocation} */
  get root() {
    return (this.parent === undefined)? this : this.parent.root;
  }

  /**
   * Return the location of the path relative to the current location.
   *
   * @param {string} path
   * @returns {SchemaLocation|undefined}
   */
  relative(path) {
    if (!path || path === '' || path === '.') {
      return this;
    }

    if (path.charAt(0) === '^') {
      return this.parent?.relative(path.slice(1));
    }

    const [propertyName, remainingPath] = behead(path);

    let propertyLocation = this.#children.get(propertyName);

    if (propertyLocation === undefined) {
      const propertySchema = this.schema.getPropertySchema(propertyName);

      if (propertySchema === undefined) {
        return undefined;
      }

      const propertyPath = this.path? `${this.path}.${propertyName}` : `${propertyName}`;

      // Secret factory of child locations!
      propertyLocation = new SchemaLocation(propertySchema);
      propertyLocation.#path = propertyPath;
      propertyLocation.#parent = this;

      this.#children.set(propertyName, propertyLocation);
    }
    return remainingPath === undefined ? propertyLocation : propertyLocation.relative(remainingPath);
  }

  /**
   * Return the location of the path relative to the root of the known location hierarchy.
   *
   * @param {string} path
   * @returns {SchemaLocation|undefined}
   */
  absolute(path) {
    return this.root.relative(path);
  }

  /**
   * Return the location of a sibling with the relative path.
   *
   * @param {string} path
   * @returns {SchemaLocation|undefined}
   */
  sibling(path) {
    if (!path) {
      return this;  // kind of weird, but run with it...
    }
    return this.parent?.relative(path);
  }

  /**
   * Return a temporary location corresponding to one of our not-yet-resolved union members.
   *
   * @param {CompiledSchema} unionSchema
   * @returns {undefined|SchemaLocation}
   */
  union(unionSchema) {
    if (unionSchema === this.#schema) {
      return this;
    }
    if (!this.schema || !this.schema.isUnion) {
      return undefined;
    }
    const unionKey = this.schema.findUnionKey(unionSchema);

    if (!unionKey) {
      return undefined;
    }
    const unionSchemaLocation = new SchemaLocation(unionSchema);
    unionSchemaLocation.#path = this.#path;
    unionSchemaLocation.#parent = this.#parent;

    return unionSchemaLocation;
  }

  /**
   * @param {(location:SchemaLocation) => any} predicate
   * @returns {Promise<SchemaLocation|undefined>}
   */
  async findPropertyLocation(predicate) {
    if (this.#schema === undefined) {
      return undefined;
    }
    for (const [propertyName] of this.#schema.propertyEntries) {
      if (propertyName === '*') {
        continue;
      }
      const propertyLocation = this.relative(propertyName);
      const result = propertyLocation !== undefined? await predicate(propertyLocation) : undefined;
      if (Boolean(result)) {
        return propertyLocation;
      }
    }
    return undefined;
  }
}