import Joi from 'joi';

export const loginSchema = Joi.object({
  // `tlds: false` disables validation against the IANA TLD list — otherwise Joi
  // rejects reserved test domains like `admin@rental.test` (RFC 2606), which the
  // seeded staff accounts use.
  email: Joi.string().trim().lowercase().email({ tlds: false }).max(255).required().messages({
    'string.email': 'email must be a valid email address',
  }),
  // No complexity rules on login — the password either matches the stored hash
  // or it does not. Rules belong on registration, which this API does not expose.
  password: Joi.string().min(1).max(128).required(),
});
