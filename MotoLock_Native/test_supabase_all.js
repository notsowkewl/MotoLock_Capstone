const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://bafziqymbvhrytziteuo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZnppcXltYnZocnl0eml0ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjAzMzUsImV4cCI6MjEwMzk5NjMzNX0.F1KVSKnN_x-8O2gKlh0d8XPydlBWTcsS0GPbCS6CP_c'
);

async function testAll() {
    const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'rider@gmail.com',
        password: 'password123!'
    });
    const uid = auth?.user?.id;
    console.log("Auth UID:", uid);

    const { data: allUsers, error: err1 } = await supabase.from('users').select('id, email, name');
    console.log("All Public Users:", allUsers);
}

testAll();
