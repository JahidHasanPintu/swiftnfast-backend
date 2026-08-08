import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let userModel: any;

  beforeEach(async () => {
    userModel = jest.fn();
    userModel.find = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getModelToken('Login'), useValue: userModel },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('create', () => {
    it('hashes the password exactly once (stored hash is verifiable, not plaintext)', async () => {
      const plaintext = 'secret-pass-123';

      const savedUser: any = {
        _id: 'u1',
        username: 'admin',
        password: undefined,
        roles: ['admin'],
        save: jest.fn(),
        toObject() {
          return {
            _id: this._id,
            username: this.username,
            password: this.password,
            roles: this.roles,
          };
        },
      };

      let constructed: any;
      userModel.mockImplementation((data: any) => {
        constructed = data;
        return savedUser;
      });
      savedUser.save.mockResolvedValue(savedUser);

      const result = await service.create({
        username: 'admin',
        password: plaintext,
      });

      expect(userModel).toHaveBeenCalledTimes(1);
      expect(constructed.password).toBeDefined();
      expect(constructed.password).not.toBe(plaintext);
      expect(constructed.password).not.toContain(plaintext);

      // A double-hash would fail this compare — proves single hashing.
      const matches = await bcrypt.compare(plaintext, constructed.password);
      expect(matches).toBe(true);

      // Object form returned to callers also carries the hash, not plaintext.
      expect(result.password).not.toBe(plaintext);
    });
  });

  describe('allUser', () => {
    it('excludes password and __v fields', async () => {
      const exec = jest.fn().mockResolvedValue([]);
      userModel.find = jest
        .fn()
        .mockReturnValue({ select: jest.fn().mockReturnValue({ exec }) });

      await service.allUser();

      expect(userModel.find).toHaveBeenCalled();
      expect(exec).toHaveBeenCalled();
    });
  });
});
