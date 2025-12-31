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
    avatarUrl?: string | null;
    role: string;
    readReceiptsEnabled: boolean; // Added
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
        // First check if profile exists
        await this.findByIdOrFail(id);

        // Use update method to avoid relation overwrite issues
        await this.profileRepository.update({ id }, data);

        // Return updated profile
        return this.findByIdOrFail(id);
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
        authUser: { id: string; email?: string; email_confirmed_at?: string | null; user_metadata?: any },
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
            avatarUrl: profile?.avatarUrl || authUser.user_metadata?.avatar_url || null,
            role: profile?.role || 'User',
            readReceiptsEnabled: profile?.readReceiptsEnabled ?? true, // Default true
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
