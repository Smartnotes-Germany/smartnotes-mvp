export const clampPercentage = (value: number) =>
  Math.round(Math.max(0, Math.min(100, value)));

export const shouldScaleFractionalPercentages = (values: number[]) => {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) {
    return false;
  }

  const maxValue = Math.max(...finiteValues);
  return maxValue > 0 && maxValue <= 1;
};

export const normalizePercentageValue = (
  value: number,
  shouldScaleFractions: boolean,
) => clampPercentage(shouldScaleFractions ? value * 100 : value);
