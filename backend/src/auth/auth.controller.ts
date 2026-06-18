import {
  ClassSerializerInterceptor,
  Controller,
  HttpCode,
  Post,
  Headers,
  Request,
  UseGuards,
  UseInterceptors,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guard/local-auth.guard';
import type { Request as ExpressRequest, Response } from 'express';
import {
  ApiBasicAuth,
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { UserEntity } from 'src/user/entities/user.entity';
import { bearerTokenType } from './dto/token-types.auth.dto';

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
  @ApiBasicAuth()
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'Created User.', type: UserEntity })
  @ApiOperation({ description: 'Register User with Basic Token' })
  register(@Headers('authorization') rawToken: string) {
    return this.authService.register(rawToken);
  }

  @Post('signin')
  @HttpCode(200)
  @ApiBasicAuth()
  @ApiResponse({
    status: 200,
    description: 'Sign In Succeed. Sets httpOnly refreshToken cookie.',
    schema: { example: { accessToken: 'eyJ...' } },
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Invalid Credentials.' })
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
  @ApiResponse({ status: 204, description: 'Sign Out Succeed.' })
  async signOut(
    @Headers('authorization') rawToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (rawToken) {
      try {
        await this.authService.signOut(rawToken);
      } catch {
        // Token expired or invalid — cookie still gets cleared
      }
    }
    res.clearCookie(REFRESH_TOKEN_COOKIE, COOKIE_OPTIONS);
  }

  @Post('token/refreshaccess')
  @HttpCode(200)
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

  @UseGuards(LocalAuthGuard)
  @Post('signin/local')
  @HttpCode(200)
  @ApiOperation({
    description: 'Sign in using alternative Passport local strategy.',
  })
  @ApiResponse({ status: 200, description: 'Issued Token Successfully.' })
  @ApiResponse({ status: 401, description: 'Invalid Credentials.' })
  @ApiBody({ type: CreateUserDto, required: true })
  async userLocalLoginPassport(
    @Request() req: ExpressRequest & { user: { id: number; role: number } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = await this.authService.issueToken(req.user, true);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return {
      accessToken: await this.authService.issueToken(req.user, false),
    };
  }
}
