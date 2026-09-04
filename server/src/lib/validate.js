import { z } from 'zod';

export const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex color like #aabbcc');

export const isoDate = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'must be an ISO date/datetime');

export const idParam = z.coerce.number().int().positive();

// Parse and coerce an :id route param, throwing a clean 400 on failure.
export function parseId(value) {
  const r = idParam.safeParse(value);
  if (!r.success) {
    const err = new Error('Invalid id');
    err.status = 400;
    throw err;
  }
  return r.data;
}
