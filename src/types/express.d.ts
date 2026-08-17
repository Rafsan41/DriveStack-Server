import type { AuthenticatedStaff } from '../modules/auth/auth.types';

/**
 * Spec §5: "Extend Express's Request type with the decoded JWT payload."
 *
 * `authenticate` populates `req.staff`. It is optional here because the property
 * genuinely is absent on unauthenticated routes such as POST /auth/login — use
 * `requireStaff(req)` from auth.middleware.ts to narrow it without assertions.
 */
declare global {
  namespace Express {
    interface Request {
      staff?: AuthenticatedStaff;
    }
  }
}

export {};
