import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { verify } from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';

describe('AuthService', () => {
  let service: AuthService;
  let userService: any;
  let configService: any;

  beforeEach(async () => {
    userService = {
      create: jest.fn(),
      findOneByUsername: jest.fn(),
    };
    configService = { get: jest.fn().mockReturnValue('test-jwt-secret') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('signin', () => {
    it('returns a JWT when the password matches the single hash', async () => {
      const password = 'correct-horse';
      const hash = await bcrypt.hash(password, 10);
      userService.findOneByUsername.mockResolvedValue({
        _id: 'u1',
        username: 'admin',
        password: hash,
      });

      const token = await service.signin({ username: 'admin', password });

      expect(typeof token).toBe('string');
      const payload: any = verify(token, 'test-jwt-secret');
      expect(payload.username).toBe('admin');
      expect(payload._id).toBe('u1');
    });

    it('throws ForbiddenException for an unknown user', async () => {
      userService.findOneByUsername.mockResolvedValue(null);

      await expect(
        service.signin({ username: 'ghost', password: 'x' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException for a wrong password', async () => {
      const hash = await bcrypt.hash('right', 10);
      userService.findOneByUsername.mockResolvedValue({
        _id: 'u1',
        username: 'admin',
        password: hash,
      });

      await expect(
        service.signin({ username: 'admin', password: 'wrong' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('signupUser', () => {
    it('delegates to userService.create (single-hash lives in UserService)', async () => {
      const payload = { username: 'newuser', password: 'p', roles: ['staff'] };
      userService.create.mockResolvedValue({ id: 'u2' });

      await service.signupUser(payload as any);

      expect(userService.create).toHaveBeenCalledWith(payload);
    });
  });
});
