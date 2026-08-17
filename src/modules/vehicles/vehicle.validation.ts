import Joi from 'joi';

/**
 * These bodies arrive as multipart/form-data, so every field is a string on the
 * wire. Joi's `convert: true` (set in validate.middleware.ts) coerces
 * `daily_rate` and `remove_photo` to their real types before the service sees them.
 */
export const createVehicleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  plate_number: Joi.string().trim().uppercase().min(3).max(32).required(),
  category: Joi.string().trim().lowercase().min(2).max(60).required(),
  daily_rate: Joi.number().positive().precision(2).max(99999999).required(),
});

export const updateVehicleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150),
  plate_number: Joi.string().trim().uppercase().min(3).max(32),
  category: Joi.string().trim().lowercase().min(2).max(60),
  daily_rate: Joi.number().positive().precision(2).max(99999999),
  remove_photo: Joi.boolean(),
});

export const listVehiclesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  category: Joi.string().trim().lowercase().max(60),
  search: Joi.string().trim().max(150).allow(''),
});

export const vehicleIdParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});
