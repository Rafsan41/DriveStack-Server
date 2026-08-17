import type { JwtPayload } from 'jsonwebtoken';

/** Row exactly as it exists in the `staff` table. */
export interface StaffRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface LoginRequestBody {
  email: string;
  password: string;
}

/** What `authenticate` puts on `req.staff` — never includes the password hash. */
export interface AuthenticatedStaff {
  id: number;
  email: string;
  name: string;
}

/** Claims carried by the JWT. `sub` holds the staff id, per RFC 7519. */
export interface JwtStaffPayload extends JwtPayload {
  sub: string;
  email: string;
  name: string;
}

export interface LoginResponseData {
  token: string;
  token_type: 'Bearer';
  expires_in: string;
  staff: AuthenticatedStaff;
}
