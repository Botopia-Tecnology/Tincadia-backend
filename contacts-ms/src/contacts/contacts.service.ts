import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactMatchCache, ContactSyncChunkResult, ContactSyncState, Profile } from '../entities';
import { StartContactsSyncDto } from './dto/start-contacts-sync.dto';
import { ContactsSyncChunkDto } from './dto/contacts-sync-chunk.dto';
import { CompleteContactsSyncDto } from './dto/complete-contacts-sync.dto';
import { PauseResumeDto } from './dto/pause-resume.dto';
import { randomUUID } from 'crypto';

type MatchResponse = {
  contact: string;
  isOnTincadia: boolean;
  userId?: string;
};

@Injectable()
export class ContactsService {
  private readonly chunkSize = parseInt(process.env.CONTACTS_CHUNK_SIZE || '100', 10);
  private readonly throttleMs = parseInt(process.env.CONTACTS_THROTTLE_MS || '1000', 10); // 1 segundo para desarrollo
  private readonly syncVersion = parseInt(process.env.CONTACTS_SYNC_VERSION || '1', 10);

  constructor(
    @InjectRepository(Profile) private readonly profilesRepo: Repository<Profile>,
    @InjectRepository(ContactSyncState) private readonly stateRepo: Repository<ContactSyncState>,
    @InjectRepository(ContactMatchCache) private readonly cacheRepo: Repository<ContactMatchCache>,
    @InjectRepository(ContactSyncChunkResult) private readonly chunkRepo: Repository<ContactSyncChunkResult>,
  ) {}

  async getState(userId: string) {
    const state = await this.stateRepo.findOne({ where: { userId } });
    if (!state) {
      return {
        userId,
        status: 'idle',
        syncVersion: this.syncVersion,
        cursor: 0,
        lastFullSyncAt: null,
        lastDeltaSyncAt: null,
        lastBatchId: null,
        lastSyncMode: null,
      };
    }

    return {
      userId: state.userId,
      status: state.status,
      syncVersion: state.syncVersion,
      cursor: state.cursor ?? 0,
      lastFullSyncAt: state.lastFullSyncAt ?? null,
      lastDeltaSyncAt: state.lastDeltaSyncAt ?? null,
      lastBatchId: state.lastBatchId ?? null,
      lastSyncMode: state.lastSyncMode ?? null,
      lastChunkAt: state.lastChunkAt ?? null,
    };
  }

  async start(dto: StartContactsSyncDto) {
    const batchId = randomUUID();

    const existing = await this.stateRepo.findOne({ where: { userId: dto.userId } });
    const state = this.stateRepo.create({
      userId: dto.userId,
      status: 'syncing',
      syncVersion: this.syncVersion,
      lastBatchId: batchId,
      lastSyncMode: dto.syncMode,
      deviceId: dto.deviceId || null,
      cursor: 0,
      lastChunkAt: null,
      lastFullSyncAt: existing?.lastFullSyncAt ?? null,
      lastDeltaSyncAt: existing?.lastDeltaSyncAt ?? null,
    });

    await this.stateRepo.save(state);

    return {
      batchId,
      chunkSize: this.chunkSize,
      throttleMs: this.throttleMs,
    };
  }

  private normalizeContactKey(input: string): string {
    // Remove all non-digit characters
    let digits = (input || '').replace(/\D/g, '');
    
    // Handle Colombian numbers: remove country code 57 if present
    if (digits.startsWith('57') && digits.length > 10) {
      digits = digits.slice(2);
    }
    
    // Handle numbers starting with 0
    if (digits.startsWith('0') && digits.length > 10) {
      digits = digits.slice(1);
    }
    
    // Return last 10 digits
    if (digits.length > 10) {
      digits = digits.slice(-10);
    }
    
    return digits;
  }

  private ensureCanProcessChunk(state: ContactSyncState) {
    if (state.status === 'paused') {
      throw new ConflictException('Sync is paused');
    }
    if (state.status !== 'syncing' && state.status !== 'completed') {
      throw new ConflictException(`Sync is not active (status=${state.status})`);
    }

    if (state.lastChunkAt) {
      const elapsed = Date.now() - state.lastChunkAt.getTime();
      if (elapsed < this.throttleMs) {
        throw new HttpException(
          {
            message: 'Chunks are being sent too fast',
            nextRecommendedDelayMs: this.throttleMs - elapsed,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  async processChunk(dto: ContactsSyncChunkDto) {
    const state = await this.stateRepo.findOne({ where: { userId: dto.userId } });
    if (!state) {
      throw new ConflictException('Sync not started');
    }

    if (!state.lastBatchId || state.lastBatchId !== dto.batchId) {
      throw new ConflictException('Invalid batchId for this user');
    }

    this.ensureCanProcessChunk(state);

    if (!Array.isArray(dto.contacts) || dto.contacts.length === 0) {
      throw new BadRequestException('contacts must be a non-empty array');
    }

    if (dto.contacts.length > this.chunkSize) {
      throw new BadRequestException(`contacts length exceeds chunkSize (${this.chunkSize})`);
    }

    // Idempotencia fuerte: si ya procesamos (userId,batchId,chunkIndex), devolvemos lo almacenado.
    const existingChunk = await this.chunkRepo.findOne({
      where: { userId: dto.userId, batchId: dto.batchId, chunkIndex: dto.chunkIndex },
    });
    if (existingChunk) {
      return existingChunk.response;
    }

    const normalizedContacts = dto.contacts.map((c) => this.normalizeContactKey(c));
    const uniqueContacts = Array.from(new Set(normalizedContacts.filter(Boolean)));

    // Matching eficiente: SELECT ... WHERE phone IN (...)
    const matchedProfiles = await this.profilesRepo
      .createQueryBuilder('p')
      .select(['p.id', 'p.phone'])
      .where('p.phone IN (:...phones)', { phones: uniqueContacts })
      .getMany();

    const phoneToUserId = new Map<string, string>();
    for (const p of matchedProfiles) {
      if (p.phone) phoneToUserId.set(p.phone, p.id);
    }

    const matches: MatchResponse[] = normalizedContacts.map((contact) => {
      const userId = phoneToUserId.get(contact);
      return userId
        ? { contact, isOnTincadia: true, userId }
        : { contact, isOnTincadia: false };
    });

    // Cache por contacto (opcional pero útil)
    const now = new Date();
    const cacheRows = uniqueContacts.map((contactKey) => {
      const matchedUserId = phoneToUserId.get(contactKey) || null;
      return this.cacheRepo.create({
        userId: dto.userId,
        contactKey,
        matchedUserId,
        matched: Boolean(matchedUserId),
        checkedAt: now,
      });
    });

    // upsert por (user_id, contact_key)
    if (cacheRows.length) {
      await this.cacheRepo
        .createQueryBuilder()
        .insert()
        .into(ContactMatchCache)
        .values(cacheRows)
        .orUpdate(['matched_user_id', 'matched', 'checked_at'], ['user_id', 'contact_key'])
        .execute();
    }

    state.cursor = typeof dto.cursorAfterChunk === 'number' ? dto.cursorAfterChunk : (state.cursor ?? 0) + normalizedContacts.length;
    state.lastChunkAt = now;
    await this.stateRepo.save(state);

    const response = {
      matches,
      acceptedChunkIndex: dto.chunkIndex,
      nextRecommendedDelayMs: this.throttleMs,
    };

    await this.chunkRepo.save(
      this.chunkRepo.create({
        userId: dto.userId,
        batchId: dto.batchId,
        chunkIndex: dto.chunkIndex,
        response,
      }),
    );

    return response;
  }

  async complete(dto: CompleteContactsSyncDto) {
    const state = await this.stateRepo.findOne({ where: { userId: dto.userId } });
    if (!state) {
      throw new ConflictException('Sync not started');
    }
    if (!state.lastBatchId || state.lastBatchId !== dto.batchId) {
      throw new ConflictException('Invalid batchId for this user');
    }

    state.status = 'completed';
    if (typeof dto.finalCursor === 'number') {
      state.cursor = dto.finalCursor;
    }

    const now = new Date();
    if (state.lastSyncMode === 'full') {
      state.lastFullSyncAt = now;
    } else if (state.lastSyncMode === 'delta') {
      state.lastDeltaSyncAt = now;
    }

    await this.stateRepo.save(state);
    return { ok: true };
  }

  async pause(dto: PauseResumeDto) {
    const state = await this.stateRepo.findOne({ where: { userId: dto.userId } });
    if (!state || state.lastBatchId !== dto.batchId) {
      throw new ConflictException('Invalid batchId for this user');
    }
    state.status = 'paused';
    await this.stateRepo.save(state);
    return { ok: true };
  }

  async resume(dto: PauseResumeDto) {
    const state = await this.stateRepo.findOne({ where: { userId: dto.userId } });
    if (!state || state.lastBatchId !== dto.batchId) {
      throw new ConflictException('Invalid batchId for this user');
    }
    state.status = 'syncing';
    await this.stateRepo.save(state);
    return { ok: true };
  }
}


