import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../core/ApiError';
import type { StaffRepository } from './staff.repository';
import type { LoginRequestBody, LoginResponseData, StaffRow } from './auth.types';

/**
 * Compared against when the email does not exist, so a request for an unknown
 * account costs the same time as one for a known account. Without this, response
 * timing tells an attacker which emails are registered.
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-password', env.bcryptSaltRounds);

export class AuthService {
  constructor(private readonly staffRepository: StaffRepository) {}

  public async login(input: LoginRequestBody): Promise<LoginResponseData> {
    const staff = await this.staffRepository.findByEmail(input.email);

    const passwordMatches = await bcrypt.compare(
      input.password,
      staff?.password_hash ?? DUMMY_PASSWORD_HASH,
    );

    // One message for both failure modes — never reveal which half was wrong.
    if (!staff || !passwordMatches) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    return {
      token: this.signToken(staff),
      token_type: 'Bearer',
      expires_in: env.jwt.expiresIn,
      staff: { id: staff.id, email: staff.email, name: staff.name },
    };
  }

  private signToken(staff: StaffRow): string {
    const options: jwt.SignOptions = {
      subject: String(staff.id),
      expiresIn: env.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    };
    return jwt.sign({ email: staff.email, name: staff.name }, env.jwt.secret, options);
  }
}
