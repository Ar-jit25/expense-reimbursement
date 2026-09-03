
const { createClient } = require('@supabase/supabase-js');
const { getMockUser } = require('./mock-identities');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment");
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

if (process.env.MOCK_AUTH === 'true') {
  const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
  
  supabase.auth.getUser = async (token) => {
    const mockUser = getMockUser(token);
    if (mockUser) return mockUser;
    
    return originalGetUser(token);
  };
}

module.exports = supabase;
