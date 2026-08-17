import Joi from 'joi';
import { isIsoDate } from '../../core/dates';
import { RENTAL_STATUSES } from './rental.types';

/**
 * A calendar date as `YYYY-MM-DD`.
 *
 * Deliberately a string, not `Joi.date()`: Joi would hand back a JS `Date` at
 * local midnight and reintroduce exactly the timezone drift that the pg DATE
 * parser exists to prevent. The custom check also rejects dates the regex
 * accepts but the calendar does not, such as 2025-02-30.
 */
const isoDate = Joi.string()
  .trim()
  .custom((value: string, helpers) => (isIsoDate(value) ? value : helpers.error('any.invalid')))
  .messages({ 'any.invalid': 'must be a real calendar date in YYYY-MM-DD format' });

const phone = Joi.string()
  .trim()
  .pattern(/^\+?[0-9\s-]{6,20}$/)
  .messages({ 'string.pattern.base': 'must be a valid phone number' });

/** Shared cross-field rule so an inverted range fails validation, not the DB. */
function endAfterStart<T extends { start_date?: string; end_date?: string }>(
  value: T,
  helpers: Joi.CustomHelpers,
): T | Joi.ErrorReport {
  if (value.start_date && value.end_date && value.end_date < value.start_date) {
    return helpers.error('any.invalid');
  }
  return value;
}

const dateOrderMessage = { 'any.invalid': 'end_date must be on or after start_date' };

export const createRentalSchema = Joi.object({
  vehicle_id: Joi.number().integer().positive().required(),
  customer_name: Joi.string().trim().min(2).max(150).required(),
  customer_phone: phone.required(),
  start_date: isoDate.required(),
  end_date: isoDate.required(),
  // total_amount is intentionally NOT accepted — spec §4 says it is computed
  // server-side. `stripUnknown` drops it if a client sends it anyway.
  status: Joi.string()
    .valid(...RENTAL_STATUSES)
    .default('booked'),
})
  .custom(endAfterStart, 'date order')
  .messages(dateOrderMessage);

export const updateRentalSchema = Joi.object({
  vehicle_id: Joi.number().integer().positive(),
  customer_name: Joi.string().trim().min(2).max(150),
  customer_phone: phone,
  start_date: isoDate,
  end_date: isoDate,
  status: Joi.string().valid(...RENTAL_STATUSES),
})
  .min(1)
  .custom(endAfterStart, 'date order')
  .messages({
    ...dateOrderMessage,
    'object.min': 'Provide at least one field to update.',
  });

export const listRentalsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  vehicle_id: Joi.number().integer().positive(),
  status: Joi.string().valid(...RENTAL_STATUSES),
  start_date: isoDate,
  end_date: isoDate,
  search: Joi.string().trim().max(150).allow(''),
})
  .custom(endAfterStart, 'date order')
  .messages(dateOrderMessage);

export const rentalIdParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
