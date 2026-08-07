import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';
import { RefreshService } from './refresh.service';

function makeRepo(): jest.Mocked<Repository<RefreshToken>> {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
    create: jest.fn().mockImplementation((x) => ({ id: 'new-sid', ...x })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 2 }),
  } as unknown as jest.Mocked<Repository<RefreshToken>>;
}

describe('RefreshService', () => {
  let repo: jest.Mocked<Repository<RefreshToken>>;
  let service: RefreshService;

  beforeEach(() => {
    repo = makeRepo();
    const config = {
      get: (k: string) => (k === 'refresh.ttlDays' ? 30 : undefined),
    } as unknown as ConfigService;
    service = new RefreshService(repo, config);
  });

  describe('issue', () => {
    it('returns a token with a future expiry and persists a hash', async () => {
      const { token, expiresAt } = await service.issue('user-1');
      expect(token).toHaveLength(64); // 32 random bytes as hex
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(repo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('rotate', () => {
    it('revokes the presented token and issues a new one', async () => {
      const row = {
        id: 'r1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000),
      } as RefreshToken;
      repo.findOne.mockResolvedValue(row);

      const { userId, issued } = await service.rotate('rawtoken');

      expect(userId).toBe('user-1');
      expect(issued.token).toHaveLength(64);
      expect(row.revokedAt).toBeInstanceOf(Date); // old one revoked
      // one save to revoke the old row, one to persist the new token
      expect(repo.save).toHaveBeenCalledTimes(2);
    });

    it('rejects an unknown token', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.rotate('x')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a revoked token', async () => {
      repo.findOne.mockResolvedValue({
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
      } as RefreshToken);
      await expect(service.rotate('x')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an expired token', async () => {
      repo.findOne.mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      } as RefreshToken);
      await expect(service.rotate('x')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('revokeAllForUser', () => {
    it('marks all active tokens revoked and returns their sids', async () => {
      repo.find.mockResolvedValue([
        { id: 's1' } as RefreshToken,
        { id: 's2' } as RefreshToken,
      ]);
      const sids = await service.revokeAllForUser('user-1');
      expect(sids).toEqual(['s1', 's2']);
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
