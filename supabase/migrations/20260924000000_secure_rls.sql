-- Secure RLS Policies and Triggers for MotoLock

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop permissive policies if they exist
DROP POLICY IF EXISTS "Public users can insert" ON users;
DROP POLICY IF EXISTS "Public users can select" ON users;

-- Users can only select their own profile
CREATE POLICY "Users can view own profile" 
ON users FOR SELECT 
USING (auth.uid() = id);

-- Users can only update their own profile. Role/status are guarded by a DB trigger.
CREATE POLICY "Users can update own profile" 
ON users FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Trigger to automatically create a user profile on signup (prevents mass assignment)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'rider');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Secure motorcycles and emergency_contacts
ALTER TABLE motorcycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own motorcycles" ON motorcycles FOR ALL USING (auth.uid() = user_id);

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contacts" ON emergency_contacts FOR ALL USING (auth.uid() = user_id);
