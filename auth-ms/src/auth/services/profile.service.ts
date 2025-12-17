import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from '../../entities/profile.entity';

export interface CreateProfileData {
    id: string;
    firstName: string;
    lastName?: string;
    documentTypeId?: number;
    documentNumber: string;
    phone: string;
}

export interface UserResponse {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    documentNumber: string;
    phone: string;
    documentType?: string | null;
    emailVerified: boolean;
}

@Injectable()
export class ProfileService {
    constructor(
        @InjectRepository(Profile)
        private readonly profileRepository: Repository<Profile>,
    ) { }

    async create(data: CreateProfileData): Promise<Profile> {
        const profile = this.profileRepository.create(data);
        return this.profileRepository.save(profile);
    }

    async findById(id: string): Promise<Profile | null> {
        return this.profileRepository.findOne({
            where: { id },
            relations: ['documentType'],
        });
    }

    async findByIdOrFail(id: string): Promise<Profile> {
        const profile = await this.findById(id);
        if (!profile) {
            throw new NotFoundException('User not found');
        }
        return profile;
    }

    async update(id: string, data: Partial<Profile>): Promise<Profile> {
        const profile = await this.findByIdOrFail(id);
        Object.assign(profile, data);
        return this.profileRepository.save(profile);
    }

    async findAllExcept(excludeUserId: string): Promise<Profile[]> {
        return this.profileRepository
            .createQueryBuilder('profile')
            .where('profile.id != :excludeUserId', { excludeUserId })
            .orderBy('profile.firstName', 'ASC')
            .getMany();
    }

    toUserResponse(
        profile: Profile | null,
        authUser: { id: string; email?: string; email_confirmed_at?: string | null },
    ): UserResponse {
        return {
            id: authUser.id,
            email: authUser.email || '',
            firstName: profile?.firstName || '',
            lastName: profile?.lastName || '',
            documentNumber: profile?.documentNumber || '',
            phone: profile?.phone || '',
            documentType: profile?.documentType?.name || null,
            emailVerified: !!authUser.email_confirmed_at,
        };
    }

    isProfileComplete(profile: Profile | null): boolean {
        if (!profile) return false;
        return !!(
            profile.documentNumber &&
            profile.phone &&
            profile.documentTypeId
        );
    }
}
