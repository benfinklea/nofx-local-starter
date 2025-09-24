import { Buffer } from 'node:buffer';
import type { JsonValue } from './store';

type JsonObject = Record<string, JsonValue>;

type WithEntries = Record<string, unknown>;

function isRecord(value: unknown): value is WithEntries {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePrimitive(value: unknown): JsonValue | undefined {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    if (value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER) {
      return Number(value);
    }
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('utf8');
  }
  return undefined;
}

export function toJsonValue(input: unknown): JsonValue {
  const primitive = normalizePrimitive(input);
  if (primitive !== undefined) return primitive;

  if (Array.isArray(input)) {
    return input.map((item) => toJsonValue(item));
  }

  if (input instanceof Set) {
    return Array.from(input).map((item) => toJsonValue(item));
  }

  if (input instanceof Map) {
    const obj: JsonObject = {};
    for (const [key, value] of input.entries()) {
      if (typeof key !== 'string') continue;
      if (value === undefined) continue;
      obj[key] = toJsonValue(value);
    }
    return obj;
  }

  if (isRecord(input)) {
    const obj: JsonObject = {};
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      obj[key] = toJsonValue(value);
    }
    return obj;
  }

  if (input === undefined) return null;
  return String(input);
}

export function toJsonObject(input: unknown): JsonObject {
  const value = toJsonValue(input);
  if (isRecord(value)) return value;
  return {};
}

export function mergeJsonObjects(
  ...objects: Array<Record<string, unknown> | undefined>
): JsonObject {
  const result: JsonObject = {};
  for (const obj of objects) {
    if (!obj) continue;
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;
      result[key] = toJsonValue(value);
    }
  }
  return result;
}
