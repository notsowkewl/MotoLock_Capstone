const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://bafziqymbvhrytziteuo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZnppcXltYnZocnl0eml0ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjAzMzUsImV4cCI6MjEwMzk5NjMzNX0.F1KVSKnN_x-8O2gKlh0d8XPydlBWTcsS0GPbCS6CP_c'
);

async function testEndToEnd() {
    const email = 'end2end_' + Date.now() + '@example.com';
    const { data: auth, error: authErr } = await supabase.auth.signUp({
        email: email,
        password: 'password123!'
    });
    const uid = auth.user.id;
    const emb = new Array(128).fill(0.1);
    const jsonStr = "[" + emb.join(",") + "]";

    const { error: insErr } = await supabase.from('users').insert({
        id: uid,
        name: "Rider",
        email: email,
        face_descriptor: jsonStr,
        password_hash: "managed_by_auth"
    });
    console.log("Insert Error:", insErr);

    let { data: profile2 } = await supabase.from('users').select('*').eq('id', uid);
    let hasFaceIdAfter = (profile2 && profile2.length > 0 && profile2[0].face_descriptor !== null);
    console.log("Final hasFaceId:", hasFaceIdAfter);
}

testEndToEnd();
