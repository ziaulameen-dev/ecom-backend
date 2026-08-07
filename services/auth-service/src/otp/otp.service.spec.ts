import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { LoginOtp } from './login-otp.entity';
import { OtpService } from './otp.service';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const CONFIG: Record<string, number> = {
  'otp.length': 6,
  'otp.ttlSeconds': 300,
  'otp.maxAttempts': 5,
  'otp.resendCooldownSeconds': 60,
};

function makeRepo(): jest.Mocked<Repository<LoginOtp>> {
  return {
    findOne: jest.fn(),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
    create: jest.fn().mockImplementation((x) => x),
    increment: jest.fn().mockResolvedValue({ affected: 1 }),
  } as unknown as jest.Mocked<Repository<LoginOtp>>;
}

describe('OtpService', () => {
  let repo: jest.Mocked<Repository<LoginOtp>>;
  let service: OtpService;

  beforeEach(() => {
    repo = makeRepo();
    const config = {
      get: (k: string) => CONFIG[k],
    } as unknown as ConfigService;
    service = new OtpService(repo, config);
  });

  describe('issue', () => {
    it('creates a numeric code of the configured length', async () => {
      repo.findOne.mockResolvedValue(null);
      const { code, ttlSeconds } = await service.issue('A@Example.com');
      expect(code).toMatch(/^\d{6}$/);
      expect(ttlSeconds).toBe(300);
      expect(repo.save).toHaveBeenCalled();
    });

    it('rejects a resend within the cooldown window (429)', async () => {
      repo.findOne.mockResolvedValue({
        createdAt: new Date(Date.now() - 10_000), // 10s ago < 60s cooldown
      } as LoginOtp);
      await expect(service.issue('a@b.com')).rejects.toBeInstanceOf(
        HttpException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('allows a resend after the cooldown has elapsed', async () => {
      repo.findOne.mockResolvedValue({
        createdAt: new Date(Date.now() - 120_000), // 120s ago > 60s
      } as LoginOtp);
      await expect(service.issue('a@b.com')).resolves.toBeDefined();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    const base = (over: Partial<LoginOtp>): LoginOtp =>
      ({
        id: '1',
        email: 'a@b.com',
        codeHash: sha256('123456'),
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 0,
        ...over,
      }) as LoginOtp;

    it('returns not_found when there is no challenge', async () => {
      repo.findOne.mockResolvedValue(null);
      expect(await service.verify('a@b.com', '123456')).toEqual({
        ok: false,
        reason: 'not_found',
      });
    });

    it('accepts the correct code and consumes it', async () => {
      repo.findOne.mockResolvedValue(base({}));
      expect(await service.verify('a@b.com', '123456')).toEqual({ ok: true });
      expect(repo.delete).toHaveBeenCalledWith({ id: '1' });
    });

    it('rejects a wrong code and counts the attempt', async () => {
      repo.findOne.mockResolvedValue(base({}));
      expect(await service.verify('a@b.com', '000000')).toEqual({
        ok: false,
        reason: 'mismatch',
      });
      expect(repo.increment).toHaveBeenCalled();
    });

    it('rejects and deletes an expired code', async () => {
      repo.findOne.mockResolvedValue(
        base({ expiresAt: new Date(Date.now() - 1000) }),
      );
      expect(await service.verify('a@b.com', '123456')).toEqual({
        ok: false,
        reason: 'expired',
      });
      expect(repo.delete).toHaveBeenCalledWith({ id: '1' });
    });

    it('locks out after too many attempts', async () => {
      repo.findOne.mockResolvedValue(base({ attempts: 5 }));
      expect(await service.verify('a@b.com', '123456')).toEqual({
        ok: false,
        reason: 'too_many_attempts',
      });
    });
  });
});
