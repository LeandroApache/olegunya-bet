import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
    ) { }

    private normalizeEmail(email: string) {
        return email.trim().toLowerCase();
    }

    async bootstrapUser(email: string, password: string) {
        const usersCount = await this.prisma.user.count();
        if (usersCount > 0) {
            throw new BadRequestException('User already bootstrapped');
        }

        const normalizedEmail = this.normalizeEmail(email);
        const passwordHash = await bcrypt.hash(password, 10);

        const user = await this.prisma.user.create({
            data: { email: normalizedEmail, passwordHash },
            select: { id: true, email: true },
        });

        return this.issueAccessToken(user.id, user.email);
    }

    async login(email: string, password: string) {
        const normalizedEmail = this.normalizeEmail(email);

        const user = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true, email: true, passwordHash: true },
        });

        if (!user) throw new UnauthorizedException('Invalid credentials');

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) throw new UnauthorizedException('Invalid credentials');

        return this.issueAccessToken(user.id, user.email);
    }

    private async issueAccessToken(userId: string, email: string) {
        const accessToken = await this.jwt.signAsync(
            { sub: userId, email },
            { expiresIn: '12h' },
        );

        return { accessToken };
    }
}
