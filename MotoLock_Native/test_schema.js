const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://bafziqymbvhrytziteuo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZnppcXltYnZocnl0eml0ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjAzMzUsImV4cCI6MjEwMzk5NjMzNX0.F1KVSKnN_x-8O2gKlh0d8XPydlBWTcsS0GPbCS6CP_c'
);

async function checkSchema() {
    let { data: users } = await supabase.from('users').select('*').limit(1);
    console.log("Database schema of users:", JSON.stringify(users, null, 2));
}

checkSchema();
