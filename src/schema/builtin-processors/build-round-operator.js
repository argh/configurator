/**
 * Compile the $round operator - rounds number to specified decimal places
 * @type {import("../types.js").ValueProcessorDefinition}
 */
export const ROUND_OPERATOR = {
  build: (precision = 0) => {
    const multiplier = Math.pow(10, precision);

    return {
      /** @type {import("../types.js").SchemaValueProcessor<any>} */
      processor: async (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) {
          return value; // Pass through non-numeric values unchanged
        }
        return Math.round(num * multiplier) / multiplier;
      },
      description: precision > 0 ? `round(${precision})` : 'round'
    };
  }
};
