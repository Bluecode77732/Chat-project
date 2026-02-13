import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Payload } from "../interface/payload.interface";
import { UserEntity } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt-auth-guard") {
    constructor(
        private readonly configService: ConfigService,
        private readonly userService: UserService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow("ACCESS_TOKEN_SECRET"),
        });
    };


    // Exclude `password` via `Omit<>` generic type.
    async validate(payload: Payload): Promise<Omit<UserEntity, 'password'>> {
        console.log('JWT Strategy - Payload received:', payload);

        const user = await this.userService.findOne(payload.sub);
        console.log('JWT Strategy - User found:', user);

        if (!user) {
            throw new UnauthorizedException("User Not Found.");
        };

        const { password, ...rest } = user;

        return rest;
    };
}
