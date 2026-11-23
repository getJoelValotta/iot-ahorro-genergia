import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Public } from '../common/auth-user';
import { AuthTokenDto, LoginDto, RegisterDto, UserDto } from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiResponse({ status: 201, type: AuthTokenDto })
  @ApiResponse({ status: 409, description: 'EMAIL_TAKEN' })
  register(@Body() dto: RegisterDto): Promise<AuthTokenDto> {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: AuthTokenDto })
  @ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS' })
  login(@Body() dto: LoginDto): Promise<AuthTokenDto> {
    return this.auth.login(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiResponse({ status: 200, type: UserDto })
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.auth.me(user.id);
  }
}
