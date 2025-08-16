export class ConfiguratorError extends Error {

  /**
   * @param {string} message
   * @param {object} [data]
   * @param {Error} [data.cause]
   * @param {number} [data.code]
   * @param {boolean} [preserveStack]
   */
  constructor(message, data, preserveStack = false) {
    // noinspection JSCheckFunctionSignatures
    super(message, data?.cause ? {cause: data.cause} : undefined);

    if (data) {
      this.data = data;
    }
    // restore prototype chain
    const actualProto = new.target.prototype;

    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }

    if (!preserveStack) {
      delete this.stack;
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
  // eslint-disable-next-line @typescript-eslint/no-empty-function
//  set stack(str) {}
//  get cause() {
//    return super.cause ?? this.data?.cause;
//  }

  toString() {
    if (this.message) {
      return `${this.name}: ${this.message}`;
    } else if (this.cause && this.cause.message) {
      return `${this.name}: ${this.cause.message}`;
    } else {
      return this.name;
    }
  }
}
