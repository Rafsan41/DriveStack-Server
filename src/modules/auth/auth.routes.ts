import { Router } from 'express';
import { loginRateLimiter } from '../../middlewares/rateLimit.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { loginSchema } from './auth.validation';
import { StaffRepository } from './staff.repository';

// Manual constructor injection — the whole graph for this module, wired once.
const controller = new AuthController(new AuthService(new StaffRepository()));

export const authRouter: Router = Router();

authRouter.post('/login', loginRateLimiter, validate({ body: loginSchema }), controller.login);
