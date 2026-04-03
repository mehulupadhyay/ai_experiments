/**
 * Role-Based Access Control middleware.
 * Usage: requireRole('SCHOOL_ADMIN') or requireRole(['SCHOOL_ADMIN', 'TEACHER'])
 */
function requireRole(...roles) {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowed.join(' or ')}`,
      });
    }
    next();
  };
}

/**
 * Ensure user belongs to the same school as the resource being accessed.
 * Attach schoolId check via req.params.schoolId or req.body.schoolId.
 */
function requireSameSchool(req, res, next) {
  const targetSchoolId = req.params.schoolId || req.body.schoolId;
  if (targetSchoolId && targetSchoolId !== req.user.schoolId) {
    return res.status(403).json({ error: 'Cross-school access denied' });
  }
  next();
}

/**
 * Ensure email is verified before accessing protected resources.
 */
function requireEmailVerified(req, res, next) {
  if (!req.user?.emailVerified) {
    return res.status(403).json({ error: 'Email verification required' });
  }
  next();
}

module.exports = { requireRole, requireSameSchool, requireEmailVerified };
