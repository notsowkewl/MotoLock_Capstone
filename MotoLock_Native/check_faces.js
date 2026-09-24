const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://bafziqymbvhrytziteuo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZnppcXltYnZocnl0eml0ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjAzMzUsImV4cCI6MjEwMzk5NjMzNX0.F1KVSKnN_x-8O2gKlh0d8XPydlBWTcsS0GPbCS6CP_c'
);

async function checkFaces() {
    let { data: users, error } = await supabase.from('users').select('id, email, face_descriptor');
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Users in DB:");
        users.forEach(u => {
            console.log(`- ${u.email}: Face registered? ${u.face_descriptor ? 'YES' : 'NO'}`);
        });
    }
}

checkFaces();
