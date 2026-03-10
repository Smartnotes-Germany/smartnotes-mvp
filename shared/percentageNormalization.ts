export const clampPercentage = (value: number) =>
  Math.round(Math.max(0, Math.min(100, value)));

export const shouldScaleFractionalPercentages = (values: number[]) => {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) {
    return false;
  }

  return finiteValues.some(
    (value) => value > 0 && value < 1 && !Number.isInteger(value),
  );
};

export const normalizePercentageValue = (
  value: number,
  shouldScaleFractions: boolean,
) => clampPercentage(shouldScaleFractions ? value * 100 : value);
