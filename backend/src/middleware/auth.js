const supabase = require('../config/supabase');
const prisma = require('../config/prisma');

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !supabaseUser) {
    return res.status(401).json({ error: 'Invalid or expired token', details: authError?.message });
  }

  console.log("LOGIN ATTEMPT - Supabase ID:", supabaseUser.id);
  console.log("LOGIN ATTEMPT - Supabase Email:", supabaseUser.email);

  try {
    const user = await prisma.users.findUnique({
      where: { id: supabaseUser.id }
    });

    if (!user) {
      console.log("LOGIN DENIED - No matching user found in Prisma DB for ID:", supabaseUser.id);
      return res.status(403).json({
        error: 'Access denied: your account is not authorized to access this application.'
      });
    }

    req.user = user;
    next();
  } catch (dbError) {
    console.error('Error resolving user profile:', dbError);
    return res.status(500).json({ error: 'Internal server error resolving user profile' });
  }
};

module.exports = { requireAuth };
