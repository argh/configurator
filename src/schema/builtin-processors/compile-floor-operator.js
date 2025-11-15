/**
 * Compile the $floor operator - floor to specified decimal places
 */
export const FLOOR_OPERATOR = {
  compile: (precision = 0) => {
    const multiplier = Math.pow(10, precision);

    return {
      validator: async (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) {
          return value; // Pass through non-numeric values unchanged
        }
        return Math.floor(num * multiplier) / multiplier;
      },
      description: precision > 0 ? `floor(${precision})` : 'floor'
    };
  }
};
