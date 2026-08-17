import Joi from 'joi';

export const rentalsReportSchema = Joi.object({
  month: Joi.string()
    .trim()
    .pattern(/^\d{4}-(0[1-9]|1[0-2])$/)
    .required()
    .messages({
      'string.pattern.base': 'month must be in YYYY-MM format, e.g. 2025-08',
    }),
  vehicle_id: Joi.number().integer().positive(),
});
