const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://bafziqymbvhrytziteuo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZnppcXltYnZocnl0eml0ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjAzMzUsImV4cCI6MjEwMzk5NjMzNX0.F1KVSKnN_x-8O2gKlh0d8XPydlBWTcsS0GPbCS6CP_c'
);

async function test() {
    const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'
    });
    
    if (authErr) {
        console.log("Auth error:", authErr);
        // We'll just try to fetch any user if auth fails
    } else {
        console.log("Authed as:", auth?.user?.id);
    }

    const { data, error } = await supabase.from('users').select('*').limit(1);
    console.log("Users:", data, error);
}

test();
