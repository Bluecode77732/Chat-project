import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  HttpCode,
  Post,
  Headers,
  UseGuards,
  UseInterceptors,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRateLimitGuard } from './guard/auth-rate-limit.guard';
import { logger } from 'src/base/logger/logger';
import type { Request as ExpressRequest, Response } from 'express';
import {
  ApiBasicAuth,
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserEntity } from 'src/user/entities/user.entity';
import { bearerTokenType } from './dto/token-types.auth.dto';
import { RegisterDto } from './dto/register.dto';

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
};

@Controller('auth')
@ApiTags('Authentication API')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(AuthRateLimitGuard)
  @ApiBasicAuth()
  @ApiBody({ type: RegisterDto })
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Credentials (email:password) are supplied via the Basic auth header; the JSON body carries only the optional nickname.',
  })
  @ApiResponse({ status: 201, description: 'Created User.', type: UserEntity })
  @ApiResponse({
    status: 400,
    description:
      'Bad token format, email already registered, or nickname already in use.',
  })
  register(
    @Headers('authorization') rawToken: string,
    @Body() registerDto: RegisterDto,
  ) {
    return this.authService.register(rawToken, registerDto?.nickname);
  }

  @Post('signin')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  @ApiBasicAuth()
  @ApiOperation({
    summary: 'Sign in and issue tokens',
    description:
      'Credentials (email:password) are supplied via the Basic auth header. Returns the accessToken in the body and sets the refreshToken as an httpOnly cookie.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sign In Succeed. Sets httpOnly refreshToken cookie.',
    schema: { example: { accessToken: 'eyJ...' } },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad token format or invalid credentials.',
  })
  async signIn(
    @Headers('authorization') rawToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.signIn(rawToken);
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { accessToken: tokens.accessToken };
  }

  @Post('signOut')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sign out',
    description:
      'Blacklists the access token when valid and clears the refreshToken cookie. The cookie is cleared even if the token is already expired or invalid.',
  })
  @ApiResponse({ status: 204, description: 'Sign Out Succeed.' })
  async signOut(
    @Headers('authorization') rawToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (rawToken) {
      try {
        await this.authService.signOut(rawToken);
      } catch (err) {
        // Token expired or invalid — cookie still gets cleared
        logger.debug(
          `signOut token error (expected if expired): ${(err as Error).message}`,
        );
      }
    }
    res.clearCookie(REFRESH_TOKEN_COOKIE, COOKIE_OPTIONS);
  }

  @Post('token/refreshaccess')
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Refresh the access token',
    description:
      'Reads the refreshToken from the httpOnly cookie (no body or bearer header required) and returns a freshly issued accessToken.',
  })
  @ApiResponse({
    status: 200,
    description: 'Issued Token Successfully.',
    type: bearerTokenType,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Refresh token cookie missing or expired.',
  })
  async refreshAccessToken(@Req() req: ExpressRequest) {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as
      | string
      | undefined;
    if (!rawRefreshToken) {
      throw new UnauthorizedException('No refresh token');
    }
    const payload = await this.authService.parseBearerToken(
      `Bearer ${rawRefreshToken}`,
      true,
    );
    return {
      accessToken: await this.authService.issueToken(
        { id: payload.sub, role: payload.role },
        false,
      ),
    };
  }
}
