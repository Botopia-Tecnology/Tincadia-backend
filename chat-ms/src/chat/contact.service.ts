import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AddContactDto, UpdateContactDto, DeleteContactDto, GetContactsDto } from './dto/contact.dto';

@Injectable()
export class ContactService {
    private readonly logger = new Logger(ContactService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * Add a contact by phone number
     */
    async addContact(data: AddContactDto) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            // Normalize phone: remove spaces, ensure consistent format
            const inputPhone = (data.phone || '').trim();

            // Create variations to search for (handles different storage formats)
            const phoneVariations: string[] = [];

            // Add original input
            phoneVariations.push(inputPhone);

            // If starts with +, also try without it
            if (inputPhone.startsWith('+')) {
                phoneVariations.push(inputPhone.slice(1));
            } else {
                // If doesn't start with +, also try with it
                phoneVariations.push('+' + inputPhone);
            }

            // Try to find user with any of the phone variations
            const { data: targetUser, error: userError } = await supabase
                .from('profiles')
                .select('id, first_name, last_name, phone')
                .in('phone', phoneVariations)
                .limit(1)
                .single();

            if (userError || !targetUser) {
                this.logger.warn(`No user found for phone variations: ${phoneVariations.join(', ')}`);
                throw new NotFoundException('No se encontró usuario con ese número de teléfono');
            }

            // 2. Check not adding yourself
            if (targetUser.id === data.ownerId) {
                throw new BadRequestException('No puedes agregarte a ti mismo como contacto');
            }

            // 3. Check if contact already exists
            const { data: existingContact } = await supabase
                .from('contacts')
                .select('id')
                .eq('owner_id', data.ownerId)
                .eq('contact_user_id', targetUser.id)
                .single();

            if (existingContact) {
                throw new ConflictException('Este contacto ya existe en tu lista');
            }

            // 4. Create contact
            const { data: contact, error } = await supabase
                .from('contacts')
                .insert({
                    owner_id: data.ownerId,
                    contact_user_id: targetUser.id,
                    alias: data.alias || null,
                    custom_first_name: data.customFirstName || null,
                    custom_last_name: data.customLastName || null,
                })
                .select()
                .single();

            if (error) {
                this.logger.error(`Error adding contact: ${error.message}`);
                throw new BadRequestException('Error al agregar contacto');
            }

            return {
                contact: {
                    ...contact,
                    user: targetUser,
                },
            };
        } catch (error) {
            console.error('❌ Error adding contact:', error);
            if (
                error instanceof NotFoundException ||
                error instanceof BadRequestException ||
                error instanceof ConflictException
            ) {
                throw error;
            }
            throw new BadRequestException('Error al agregar contacto');
        }
    }

    /**
     * Get all contacts for a user
     */
    async getContacts(data: GetContactsDto) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            // Single query with FK join to profiles
            const { data: contacts, error } = await supabase
                .from('contacts')
                .select(`
                    id,
                    contact_user_id,
                    alias,
                    custom_first_name,
                    custom_last_name,
                    created_at,
                    profiles:contact_user_id (
                        id,
                        first_name,
                        last_name,
                        phone
                    )
                `)
                .eq('owner_id', data.ownerId)
                .order('created_at', { ascending: false });

            if (error) {
                this.logger.error(`Error getting contacts: ${error.message}`);
                throw new BadRequestException('Error al obtener contactos');
            }

            // Return friendly message if no contacts
            if (!contacts || contacts.length === 0) {
                return {
                    contacts: [],
                    message: 'Por el momento no tienes contactos para mostrar. ¡Añade a alguien!',
                };
            }

            // 2. Get auth users to retrieve avatars
            const contactUserIds = contacts.map((c: any) => c.contact_user_id);
            // Optimization: In a real app we might filter listUsers or use getUsersByIds if available
            // For now, listUsers() gets a page, we might need logic to ensure we get specific users if list is large.
            // But since we can't filter listUsers by ID array easily without RPC, we'll try to get all or assume manageable size.
            // Better approach: Since we have the IDs, let's map them.
            // Actually, Supabase Admin ListUsers doesn't support "in" array. 
            // We will fetch all and filter in memory (not ideal for huge apps but functional for now) 
            // OR simpler: iterate and fetch (slow).
            // Let's stick to listUsers() for now as in auth-ms.

            const { data: { users: authUsers } } = await supabase.auth.admin.listUsers() as { data: { users: any[] }, error: any };

            // Transform to cleaner format
            const formattedContacts = contacts.map((c: any) => {
                const authUser = authUsers?.find(u => u.id === c.contact_user_id);
                return {
                    id: c.id,
                    contactUserId: c.contact_user_id,
                    alias: c.alias,
                    customFirstName: c.custom_first_name,
                    customLastName: c.custom_last_name,
                    createdAt: c.created_at,
                    user: {
                        ...c.profiles,
                        avatarUrl: authUser?.user_metadata?.avatar_url || null,
                    },
                };
            });

            return { contacts: formattedContacts };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new BadRequestException('Error al obtener contactos');
        }
    }

    /**
     * Update a contact (alias, custom names)
     */
    async updateContact(data: UpdateContactDto) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            const updateData: Record<string, any> = {};
            if (data.alias !== undefined) updateData.alias = data.alias;
            if (data.customFirstName !== undefined) updateData.custom_first_name = data.customFirstName;
            if (data.customLastName !== undefined) updateData.custom_last_name = data.customLastName;

            const { data: contact, error } = await supabase
                .from('contacts')
                .update(updateData)
                .eq('id', data.contactId)
                .eq('owner_id', data.ownerId) // Security: only owner can update
                .select()
                .single();

            if (error || !contact) {
                throw new NotFoundException('Contacto no encontrado');
            }

            return { contact };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            throw new BadRequestException('Error al actualizar contacto');
        }
    }

    /**
     * Delete a contact and cascade delete conversations and messages
     */
    async deleteContact(data: DeleteContactDto) {
        try {
            const supabase = this.supabaseService.getAdminClient();

            // 1. Get the contact to find the contact_user_id
            const { data: contact, error: fetchError } = await supabase
                .from('contacts')
                .select('contact_user_id')
                .eq('id', data.contactId)
                .eq('owner_id', data.ownerId)
                .single();

            if (fetchError || !contact) {
                throw new NotFoundException('Contacto no encontrado');
            }

            const contactUserId = contact.contact_user_id;

            // 2. Find conversation between these two users
            // We check both combinations: (user1=me, user2=them) OR (user1=them, user2=me)
            const { data: conversations, error: convError } = await supabase
                .from('conversations')
                .select('id')
                .or(`and(user1_id.eq.${data.ownerId},user2_id.eq.${contactUserId}),and(user1_id.eq.${contactUserId},user2_id.eq.${data.ownerId})`);

            if (conversations && conversations.length > 0) {
                const conversationIds = conversations.map(c => c.id);

                // 3. Delete messages
                await supabase
                    .from('messages')
                    .delete()
                    .in('conversation_id', conversationIds);

                // 4. Delete conversations
                await supabase
                    .from('conversations')
                    .delete()
                    .in('id', conversationIds);
            }

            // 5. Delete the contact
            const { error } = await supabase
                .from('contacts')
                .delete()
                .eq('id', data.contactId)
                .eq('owner_id', data.ownerId);

            if (error) {
                throw new BadRequestException('Error al eliminar contacto');
            }

            return { success: true };
        } catch (error) {
            console.error('Error deleting contact:', error);
            if (error instanceof NotFoundException) throw error;
            throw new BadRequestException('Error al eliminar contacto');
        }
    }
}
