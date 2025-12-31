import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load env
dotenv.config({ path: resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
    const email = process.argv[2];
    const password = process.argv[3];
    const firstName = process.argv[4] || 'Admin';
    const lastName = process.argv[5] || 'User';

    if (!email || !password) {
        console.log('Usage: ts-node src/scripts/create-admin.ts <email> <password> [firstName] [lastName]');
        process.exit(1);
    }

    console.log(`Creating Admin User: ${email}`);

    // 1. Create User
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'Admin' } // Keep metadata just in case, but rely on DB column
    });

    if (authError) {
        console.error('Error creating user:', authError.message);
        if (authError.message.includes('already registered')) {
            console.log('User exists. Updating role in DB...');
            // Need user ID.
            const { data: listData } = await supabase.auth.admin.listUsers();
            const user = listData.users.find(u => u.email === email);
            if (user) {
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ role: 'Admin' })
                    .eq('id', user.id);

                if (updateError) {
                    console.error('Failed to update existing user profile:', updateError);
                } else {
                    console.log('✅ Existing user promoted to Admin.');
                }
            }
        }
    } else if (authData.user) {
        console.log('✅ User created in Supabase Auth.');

        // 2. Create Profile
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: authData.user.id,
                first_name: firstName,
                last_name: lastName,
                created_at: new Date(),
                updated_at: new Date(),
                role: 'Admin', // Set Admin Role directly in DB
                document_type_id: null
            });

        if (profileError) {
            console.error('Warning: Profile creation failed:', profileError.message);
        } else {
            console.log('✅ Profile created with Admin role.');
        }
    }
}

createAdmin();
