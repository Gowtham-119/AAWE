const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://nrrkwzjxjgvjnoiyeghc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Set it before running this script: export SUPABASE_SERVICE_ROLE_KEY="your_service_key"');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ADMIN_EMAIL = 'admin@aawe.portal';
const ADMIN_PASSWORD = '@Admin12321';
const ADMIN_DISPLAY_NAME = 'Admin User';

async function setupAdminAccount() {
  try {
    console.log(`📝 Setting up admin account: ${ADMIN_EMAIL}`);

    // Step 1: Create auth user
    console.log('  → Creating auth user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        name: ADMIN_DISPLAY_NAME,
      },
    });

    if (authError) {
      if (authError.message.includes('already exists')) {
        console.log(`  ✓ Auth user already exists: ${ADMIN_EMAIL}`);
      } else {
        throw new Error(`Auth user creation failed: ${authError.message}`);
      }
    } else {
      console.log(`  ✓ Auth user created: ${ADMIN_EMAIL}`);
    }

    // Step 2: Create user_profiles entry
    console.log('  → Creating user profile...');
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        email: ADMIN_EMAIL,
        role: 'admin',
        display_name: ADMIN_DISPLAY_NAME,
        department: null,
      }, { onConflict: 'email' });

    if (profileError) {
      throw new Error(`User profile creation failed: ${profileError.message}`);
    }
    console.log(`  ✓ User profile created`);

    // Step 3: Create users entry
    console.log('  → Creating user record...');
    const { error: usersError } = await supabase
      .from('users')
      .upsert({
        email: ADMIN_EMAIL,
        role: 'admin',
        is_active: true,
        login_count: 0,
      }, { onConflict: 'email' });

    if (usersError) {
      throw new Error(`Users table record creation failed: ${usersError.message}`);
    }
    console.log(`  ✓ User record created`);

    console.log('\n✅ Admin account setup completed successfully!');
    console.log(`\n🔑 Admin Credentials:`);
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`\n📝 Use these credentials to login to the admin panel.`);

  } catch (error) {
    console.error('❌ Setup failed');
    console.error(error.message || error);
    process.exit(1);
  }
}

setupAdminAccount();
