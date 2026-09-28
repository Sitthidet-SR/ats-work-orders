import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthRequest } from './auth.types';
import { required } from '../../common/env';
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException('กรุณาเข้าสู่ระบบ');
    let id: string;
    try {
      id = this.jwt.verify<{ sub: string }>(token, { secret: required('JWT_SECRET') }).sub;
    } catch {
      throw new UnauthorizedException('Access token หมดอายุ');
    }
    req.user = await this.auth.actor(id);
    return true;
  }
}
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const permission = this.reflector.getAllAndOverride<string>('permission', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;
    const actor = context.switchToHttp().getRequest<AuthRequest>().user;
    if (!actor?.permissions.includes(permission))
      throw new ForbiddenException('คุณไม่มีสิทธิ์ดำเนินการนี้');
    return true;
  }
}
