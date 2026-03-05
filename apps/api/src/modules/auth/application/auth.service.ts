
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async validateAdmin(username: string, pass: string): Promise<any> {
    console.log(`[AuthService] Intentando validar usuario: ${username}`);
    const admin = await this.prisma.admin.findUnique({ where: { username } });
    
    if (admin) {
      console.log(`[AuthService] Usuario encontrado en BD, verificando password...`);
      const isMatch = await bcrypt.compare(pass, admin.password);
      if (isMatch) {
         console.log(`[AuthService] Password Correcto`);
         const { password, ...result } = admin;
         return result;
      } else {
         console.log(`[AuthService] Password INCORRECTO`);
      }
    } else {
      console.log(`[AuthService] Usuario NO encontrado: ${username}`);
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
