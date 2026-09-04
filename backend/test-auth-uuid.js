const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testLogin() {
  const email = "emp@example.com";
  const password = "Employee1"; // Using the demo credentials from SUBMISSION.md
  
  console.log(`Attempting login to Supabase as ${email}...`);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error) {
    console.error("Login failed:", error.message);
    return;
  }
  
  console.log("Login successful!");
  console.log("Supabase Auth UUID for this user is:", data.user.id);
  
  const expectedId = "138af97a-5093-4f4d-9a52-e14035855c21";
  if (data.user.id !== expectedId) {
    console.log(`\nMISMATCH DETECTED!`);
    console.log(`Expected (in database): ${expectedId}`);
    console.log(`Actual (from Supabase): ${data.user.id}`);
  } else {
    console.log("UUID matches the seed script perfectly.");
  }
}
testLogin();
