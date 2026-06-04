import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

export interface TokenPayload {
  username: string;
  iat?: number;
  exp?: number;
}

/**
 * Centralised auth service.
 * Replace JWT_SECRET with a strong secret from env / secrets manager.
 * Never hard-code it in production.
 */
@Injectable()
export class AuthService {
  private readonly secret: string =
    process.env.JWT_SECRET ?? 'CHANGE_ME_IN_PRODUCTION';

  /** Token lifetime — 15 min is a sensible default; tune to your needs. */
  private readonly expiresIn = '15m';

  /** Issue a signed JWT for the given username. */
  sign(username: string): string {
    return jwt.sign({ username } as TokenPayload, this.secret, {
      expiresIn: this.expiresIn,
      algorithm: 'HS256',
    });
  }

  /**
   * Verify a JWT and return its payload.
   * Throws JsonWebTokenError / TokenExpiredError on failure.
   */
  verify(token: string): TokenPayload {
    return jwt.verify(token, this.secret, {
      algorithms: ['HS256'],
    }) as TokenPayload;
  }
}
