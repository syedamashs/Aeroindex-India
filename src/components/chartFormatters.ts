import { formatINR } from '@/data/random';

export function fareTooltipFormatter(value: unknown): [string, string] {
  return [formatINR(Number(value)), 'Avg Fare'];
}

export function indexTooltipFormatter(value: unknown): [string, string] {
  return [Number(value).toFixed(1), 'Index'];
}

export function genericFareTooltipFormatter(value: unknown): [string, string] {
  return [formatINR(Number(value)), ''];
}
