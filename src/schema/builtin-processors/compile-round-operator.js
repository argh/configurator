/**
 * Compile the $round operator - rounds number to specified decimal places
 */
export const ROUND_OPERATOR = {
  compile: (precision = 0) => {
    const multiplier = Math.pow(10, precision);

    return {
      validator: async (value) => {
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
