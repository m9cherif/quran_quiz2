const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

// Test the connection
supabase
  .from('admin_keys')
  .select('*')
  .limit(1)
  .then(({ data, error }) => {
    if (error) console.error('Connection error:', error);
    else console.log('Connected:', data);
  });

module.exports = supabase;

