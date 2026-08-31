const supabase = require('../config/supabase');
const prisma = require('../config/prisma');

/**
 * Express middleware to extract the JWT from the Authorization header,
 * verify it with Supabase, and attach the application User profile to req.user.
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  // 1. Verify token with Supabase Auth
  const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !supabaseUser) {
    return res.status(401).json({ error: 'Invalid or expired token', details: authError?.message });
  }

  try {
    // 2. Link Supabase Identity to Application Profile
    // Find the user in our Prisma DB. If they don't exist (first login), create them.
    let user = await prisma.user.findUnique({
      where: { id: supabaseUser.id }
    });

    if (!user) {
      // Extract email/name from Supabase user metadata if available
      const email = supabaseUser.email;
      const name = supabaseUser.user_metadata?.name || null;
      
      user = await prisma.user.create({
        data: {
          id: supabaseUser.id,
          email: email,
          name: name,
          // Default role is EMPLOYEE as defined in schema.prisma
        }
      });
    }

    // 3. Attach application profile to request
    req.user = user;
    next();
  } catch (dbError) {
    console.error('Error resolving user profile:', dbError);
    return res.status(500).json({ error: 'Internal server error resolving user profile' });
  }
};

module.exports = { requireAuth };
