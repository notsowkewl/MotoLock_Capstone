const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://bafziqymbvhrytziteuo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZnppcXltYnZocnl0eml0ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjAzMzUsImV4cCI6MjEwMzk5NjMzNX0.F1KVSKnN_x-8O2gKlh0d8XPydlBWTcsS0GPbCS6CP_c'
);

async function checkSchemas() {
    let { data: mc } = await supabase.from('motorcycles').select('*').limit(1);
    let { data: ec } = await supabase.from('emergency_contacts').select('*').limit(1);
    let { data: pin } = await supabase.from('pins').select('*').limit(1);
    
    console.log("Motorcycles schema:", JSON.stringify(mc, null, 2));
    console.log("Emergency Contacts schema:", JSON.stringify(ec, null, 2));
    console.log("Pins schema:", JSON.stringify(pin, null, 2));
}

checkSchemas();
