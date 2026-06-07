import {
  Controller,
  HttpCode,
  Post,
  Headers,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guard/local-auth.guard';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
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
import { bearerTokenType, tokenType } from './dto/token-types.auth.dto';

@Controller('auth')
@ApiTags('Authentication API')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // A route handler decorator, Routes (Get, Post, Patch, Put, Delete) HTTP request to the specific path.
  @Post('register')
  @ApiBasicAuth()
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'Created User.',
    type: UserEntity,
  })
  @ApiOperation({
    description: 'Register User with Basic Token',
  })
  // A route handler parameter decorator, extracts the headers property from the `req` object and populates the decorated parameter with the value of headers.
  register(@Headers('authorization') rawToken: string) {
    return this.authService.register(rawToken);
  }

  // Sign in route
  @Post('signin')
  @HttpCode(200)
  @ApiBasicAuth()
  @ApiResponse({
    status: 200,
    description: 'Sign In Succeed.',
    type: tokenType,
    schema: {
      example: {
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid Credentials. Wrong email or password.',
  })
  signIn(@Headers('authorization') rawToken: string) {
    return this.authService.signIn(rawToken);
  }

  @Post('signOut')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiResponse({
    status: 204,
    description: 'Sign Out Succeed.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  signOut(@Headers('authorization') rawToken: string) {
    return this.authService.signOut(rawToken);
  }

  // Issuing a refresh access token to let not users redo login
  @Post('token/refreshaccess')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Issued Token Successfully.',
    type: bearerTokenType,
    example: {
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
  })
  @ApiResponse({
    status: 401,
    description:
      "Unauthorized. Insert the refresh token from the 'signin' API to get the access token.",
  })
  async refreshAccessToken(@Headers('authorization') rawToken: string) {
    return this.authService.refreshAccessToken(rawToken);
  }

  // Using an `AuthGuard` that `@nestjs/passport` automatically provisioned when extend the 'passport-local' strategy.
  // `LocalAuthGuard` used literal string for avoiding conflict between duplicated strings.
  @UseGuards(LocalAuthGuard)
  @Post('signin/local')
  @HttpCode(200)
  @ApiOperation({
    description: 'Sign in using alternative Passport local strategy.',
  })
  @ApiResponse({
    status: 200,
    description: 'Issued Token Successfully.',
    type: tokenType,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid Credentials.',
  })
  @ApiBody({
    type: CreateUserDto,
    required: true,
  })
  async userLocalLoginPassport(@Request() req) {
    return {
      refreshToken: await this.authService.issueToken(req.user, true),
      accessToken: await this.authService.issueToken(req.user, false),
    };
  }
}
