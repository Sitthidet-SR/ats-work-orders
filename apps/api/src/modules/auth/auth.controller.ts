import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response, Request, CookieOptions } from 'express';
import { Public } from '../roles/permissions';
import { AuthService } from './auth.service';
import { LoginDto, ChangePasswordDto } from './auth.dto';
import { AuthRequest } from './auth.types';
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.COOKIE_SAME_SITE === 'none' ? 'none' : 'lax',
      path: '/api/auth',
    };
  }
  private response(result: Awaited<ReturnType<AuthService['login']>>, res: Response) {
    res.cookie('ats_refresh', result.refreshToken, {
      ...this.cookieOptions(),
      expires: result.expiresAt,
    });
    return { accessToken: result.accessToken, user: result.user };
  }
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.response(await this.auth.login(dto), res);
  }
  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.response(
      await this.auth.refresh((req.cookies as Record<string, string> | undefined)?.ats_refresh),
      res,
    );
  }
  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.logout(
      (req.cookies as Record<string, string> | undefined)?.ats_refresh,
    );
    res.clearCookie('ats_refresh', this.cookieOptions());
    return result;
  }
  @ApiBearerAuth() @Get('me') me(@Req() req: AuthRequest) {
    return req.user;
  }

  @ApiBearerAuth()
  @Post('change-password')
  async changePassword(@Req() req: AuthRequest, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(req.user.id, dto.newPassword);
  }
}
