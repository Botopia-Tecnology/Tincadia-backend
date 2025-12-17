import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TokenService {
    constructor(private readonly jwtService: JwtService) { }

    generateToken(user: { id: string; email?: string }): string {
        const payload = {
            sub: user.id,
            email: user.email,
        };
        return this.jwtService.sign(payload);
    }

    verifyToken(token: string): { sub: string; email: string } {
        return this.jwtService.verify(token);
    }

    decodeToken(token: string): any {
        return this.jwtService.decode(token);
    }
}
