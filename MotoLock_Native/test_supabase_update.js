const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://bafziqymbvhrytziteuo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZnppcXltYnZocnl0eml0ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjAzMzUsImV4cCI6MjEwMzk5NjMzNX0.F1KVSKnN_x-8O2gKlh0d8XPydlBWTcsS0GPbCS6CP_c'
);

async function testUpdate() {
    const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'rider@gmail.com',
        password: 'password123!'
    });
    
    if (authErr) {
        console.log("Auth error:", authErr);
        return;
    }
    const uid = auth.user.id;
    console.log("Authed as:", uid);

    const emb = new Array(128).fill(0.1);
    const jsonStr = "[" + emb.join(",") + "]";

    const { data, error } = await supabase
        .from('users')
        .update({ face_descriptor: jsonStr })
        .eq('id', uid)
        .select();

    console.log("Update result:", data);
    console.log("Update error:", error);
}

testUpdate();
