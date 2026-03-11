export type PercentageScale = "percent" | "fraction";

export const clampPercentage = (value: number) =>
  Math.round(Math.max(0, Math.min(100, value)));

export const isFractionalPercentageValue = (value: number) =>
  Number.isFinite(value) && value > 0 && value < 1 && !Number.isInteger(value);

export const normalizePercentageValue = (value: number) =>
  clampPercentage(isFractionalPercentageValue(value) ? value * 100 : value);

export const normalizePercentageValueForScale = (
  value: number,
  scale: PercentageScale,
) => clampPercentage(scale === "fraction" ? value * 100 : value);

export const inspectPercentageValues = (values: number[]) => {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  const hasFractionalValues = finiteValues.some(isFractionalPercentageValue);
  const hasExplicitPercentages = finiteValues.some((value) => value > 1);
  const hasAmbiguousOne = finiteValues.some((value) => value === 1);
  const isBinaryOnly =
    finiteValues.length > 0 &&
    finiteValues.every((value) => value === 0 || value === 1);

  return {
    finiteValues,
    hasFractionalValues,
    hasExplicitPercentages,
    hasAmbiguousOne,
    isBinaryOnly,
    hasMixedRepresentations: hasFractionalValues && hasExplicitPercentages,
  };
};
