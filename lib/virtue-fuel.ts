import type { DurationType } from "./ship-data";

export type VirtueFuelKey = "curiosity" | "integrity" | "kindness" | "resilience";

export type VirtueFuelConfig = Partial<Record<VirtueFuelKey, number>>;

export const MILLION = 1_000_000;
export const BILLION = 1_000_000_000;
export const TRILLION = 1_000_000_000_000;

export const VIRTUE_FUEL_DISPLAY: Array<{ key: VirtueFuelKey; label: string; imageSrc: string }> = [
  { key: "curiosity", label: "Curiosity", imageSrc: "/media/Egg_curiosity.webp" },
  { key: "integrity", label: "Integrity", imageSrc: "/media/Egg_integrity.webp" },
  { key: "kindness", label: "Kindness", imageSrc: "/media/Egg_kindness.webp" },
  { key: "resilience", label: "Resilience", imageSrc: "/media/Egg_resilience.webp" },
];

export const VIRTUE_FUEL_BY_SHIP_DURATION: Record<string, Partial<Record<DurationType, VirtueFuelConfig>>> = {
  BCR: {
    SHORT: { integrity: 10 * MILLION },
    LONG: { integrity: 20 * MILLION },
    EPIC: { integrity: 30 * MILLION },
  },
  MILLENIUM_CHICKEN: {
    SHORT: { integrity: 10 * BILLION },
    LONG: { integrity: 20 * BILLION },
    EPIC: { integrity: 50 * BILLION },
  },
  CORELLIHEN_CORVETTE: {
    SHORT: { integrity: 5 * BILLION },
    LONG: { integrity: 8 * BILLION },
    EPIC: { integrity: 10 * BILLION },
  },
  GALEGGTICA: {
    SHORT: { integrity: 200 * BILLION, curiosity: 200 * BILLION },
    LONG: { integrity: 400 * BILLION, curiosity: 400 * BILLION },
    EPIC: { integrity: 600 * BILLION, curiosity: 600 * BILLION },
  },
  CHICKFIANT: {
    SHORT: { kindness: 1 * TRILLION, curiosity: 1 * TRILLION },
    LONG: { kindness: 2 * TRILLION, curiosity: 2 * TRILLION },
    EPIC: { kindness: 3 * TRILLION, curiosity: 3 * TRILLION },
  },
  VOYEGGER: {
    SHORT: { kindness: 5 * TRILLION, curiosity: 10 * TRILLION },
    LONG: { kindness: 10 * TRILLION, curiosity: 20 * TRILLION },
    EPIC: { kindness: 15 * TRILLION, curiosity: 25 * TRILLION },
  },
  HENERPRISE: {
    SHORT: { kindness: 10 * TRILLION, curiosity: 15 * TRILLION },
    LONG: { resilience: 10 * TRILLION, kindness: 15 * TRILLION, curiosity: 20 * TRILLION },
    EPIC: { resilience: 20 * TRILLION, kindness: 25 * TRILLION, curiosity: 25 * TRILLION },
  },
  ATREGGIES: {
    SHORT: { kindness: 20 * TRILLION, curiosity: 25 * TRILLION },
    LONG: { resilience: 20 * TRILLION, kindness: 30 * TRILLION, curiosity: 40 * TRILLION },
    EPIC: { resilience: 40 * TRILLION, kindness: 75 * TRILLION, curiosity: 50 * TRILLION },
  },
};

export function getVirtueFuelConfig(ship: string, durationType: string): VirtueFuelConfig {
  return VIRTUE_FUEL_BY_SHIP_DURATION[ship]?.[durationType as DurationType] || {};
}

export function getVirtueFuelPerLaunch(ship: string, durationType: string): number {
  const config = getVirtueFuelConfig(ship, durationType);
  return VIRTUE_FUEL_DISPLAY.reduce((sum, fuel) => sum + Math.max(0, config[fuel.key] || 0), 0);
}

export function formatVirtueFuelQuantity(value: number): string {
  const absValue = Math.abs(value);
  const units: Array<{ value: number; suffix: string }> = [
    { value: 1_000_000_000_000_000_000, suffix: "Q" },
    { value: 1_000_000_000_000_000, suffix: "q" },
    { value: TRILLION, suffix: "T" },
    { value: BILLION, suffix: "B" },
    { value: MILLION, suffix: "M" },
  ];
  for (const unit of units) {
    if (absValue >= unit.value) {
      const scaled = value / unit.value;
      const maximumFractionDigits = Math.abs(scaled) < 10 && Math.abs(scaled % 1) > 1e-9 ? 1 : 0;
      return `${scaled.toLocaleString(undefined, { maximumFractionDigits })}${unit.suffix}`;
    }
  }
  return Math.round(value).toLocaleString();
}
