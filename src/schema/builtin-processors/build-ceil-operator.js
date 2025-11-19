/**
 * Build the $ceil operator - ceiling to specified decimal places
 * @type {import("../types.js").ValueProcessorDefinition}
 */
export const CEIL_OPERATOR = {
  keyword: 'ceil',
  builder: (precision = 0) => {
    const multiplier = Math.pow(10, precision);

    return {
      /** @type {import("../types.js").SchemaValueProcessor<any>} */
      processor: async (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) {
          return value; // Pass through non-numeric values unchanged
        }
        return Math.ceil(num * multiplier) / multiplier;
      },
      description: precision > 0 ? `ceil(${precision})` : 'ceil'
    };
  }
};
