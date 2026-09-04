const supabase = require('../config/supabase');
const prisma = require('../config/prisma');

/**
 * Express middleware to extract the JWT from the Authorization header,
 * verify it with Supabase, and attach the application User profile to req.user.
 *
 * Authorization model: invite/pre-provisioned only.
 * A valid Supabase identity does NOT automatically grant application access.
 * The user must already exist in the application User table.
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  // 1. Verify token with Supabase Auth (proves identity only)
  const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !supabaseUser) {
    return res.status(401).json({ error: 'Invalid or expired token', details: authError?.message });
  }

  try {
    // 2. Look for an existing authorized application User record (proves authorization)
    // A valid Supabase JWT alone does NOT grant access to the reimbursement application.
    // The user must be pre-provisioned in the application User table by an administrator.
    const user = await prisma.user.findUnique({
      where: { id: supabaseUser.id }
    });

    if (!user) {
      // Authenticated with Supabase but not an authorized application user.
      // NEVER auto-create a User record here.
      return res.status(403).json({
        error: 'Access denied: you are not authorized to access this application.'
      });
    }

    // 3. Attach the authorized application profile to the request
    req.user = user;
    next();
  } catch (dbError) {
    console.error('Error resolving user profile:', dbError);
    return res.status(500).json({ error: 'Internal server error resolving user profile' });
  }
};

module.exports = { requireAuth };
