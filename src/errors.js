
export class ConfiguratorError extends Error {
  /**
   * @param {string} message
   * @param {object} [data]
   * @param {Error|any} [data.cause]
   * @param {string} [data.path]
   * @param {string|number} [data.property]
   * @param {any} [data.value]
   * @param {number} [data.code]
   * @param {Array<Error>} [data.errors]
   * @param {boolean} [preserveStack]
   */
  constructor(message, data, preserveStack = false) {
    // noinspection JSCheckFunctionSignatures

    /** @type {Error|undefined} */
    const cause = data?.cause
      ? data.cause instanceof Error
        ? data.cause
        : new ConfiguratorError(data.cause, undefined, false)
      : undefined;

    super(message, cause ? { cause } : undefined);

    if (data) {
      /** @type {any} */
      this.data = { ...data, cause };
    }
    // restore prototype chain
    const actualProto = new.target.prototype;

    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      // @ts-ignore
      this.__proto__ = actualProto;
    }

    if (!preserveStack) {
      // @ts-ignore
      //      delete this.stack;
    }

    if (data?.cause && !super.cause) {
      // should be set on super, but just in case...
      this.cause = data.cause;
    }
  }

  get name() {
    return this.constructor.name;
  }
  //  get stack() {
  //    return "";
  //  }

  set stack(str) {}

  //  get cause() {
  //    return super.cause ?? this.data?.cause;
  //  }

  toString() {
    if (this.message) {
      return `${this.name}: ${this.message}`;
    } else {
      // @ts-ignore
      if (this.cause?.message) {
        // @ts-ignore
        return `${this.name}: ${this.cause.message}`;
      } else {
        return this.name;
      }
    }
  }
}


