
import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { AuthService } from '../application/auth.service';
import { AppError } from '../../../shared/errors/AppError';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super();
  }

  async validate(username: string, password: string): Promise<any> {
    const user = await this.authService.validateAdmin(username, password);
    if (!user) {
      throw new AppError('AUTH_INVALID_CREDENTIALS');
    }
    return user;
  }
}
