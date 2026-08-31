/**
 * Middleware to ensure the authenticated user has the required role.
 * Must be used AFTER requireAuth.
 */
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({ 
        error: 'Forbidden: Insufficient permissions',
        details: `Requires ${requiredRole} role. User has ${req.user.role}.`
      });
    }

    next();
  };
};

/**
 * Helper middleware for ownership checking.
 * Takes an async function that extracts/fetches the owner ID for the current request.
 */
const requireResourceOwnership = (getResourceOwnerIdFn) => {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      
      const ownerId = await getResourceOwnerIdFn(req);
      if (!ownerId) return res.status(404).json({ error: 'Resource not found' });
      
      if (req.user.id !== ownerId) {
        return res.status(403).json({ error: 'Forbidden: You do not own this resource' });
      }
      
      next();
    } catch (err) {
      console.error('Ownership check error:', err);
      res.status(500).json({ error: 'Internal server error checking ownership' });
    }
  };
};

module.exports = { requireRole, requireResourceOwnership };
