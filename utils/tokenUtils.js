const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Token = require('../models/Token');

/**
 * Generate a secure random token
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

/**
 * Generate a unique family identifier for refresh tokens
 */
const generateTokenFamily = () => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Generate a JWT access token
 * 
 * @param {Object} user - User object with id and role
 * @returns {String} JWT access token
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      role: user.role
    }, 
    process.env.JWT_SECRET, 
    { 
      expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m' 
    }
  );
};

/**
 * Create and store a refresh token in the database
 * 
 * @param {Object} user - User object
 * @param {String} family - Token family identifier (null for new family)
 * @param {Object} req - Express request object for IP and user agent
 * @returns {Object} - The token object and plaintext token
 */
const createRefreshToken = async (user, family = null, req = null) => {
  // Generate a new token family if none provided
  const tokenFamily = family || generateTokenFamily();
  
  // Generate the token
  const refreshToken = generateRefreshToken();
  
  // Calculate expiration date
  const expiresInMs = parseInt(process.env.JWT_REFRESH_EXPIRE_DAYS || '7') * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + expiresInMs);

  // Store user-agent and IP if available
  const userAgent = req?.headers?.['user-agent'] || null;
  const ipAddress = req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null;

  // Create and save the token
  const tokenDocument = await Token.create({
    user: user._id,
    token: refreshToken,
    expiresAt,
    family: tokenFamily,
    userAgent,
    ipAddress
  });

  return {
    tokenDoc: tokenDocument,
    plainToken: refreshToken
  };
};

/**
 * Find a refresh token in the database
 * 
 * @param {String} token - The refresh token to find
 * @returns {Object} - The token document
 */
const findRefreshToken = async (token) => {
  return await Token.findOne({ token, isRevoked: false });
};

/**
 * Verify a refresh token and return the related user
 * 
 * @param {String} token - The refresh token to verify
 * @returns {Object} - An object containing the user, token document, and token family
 */
const verifyRefreshToken = async (token) => {
  // Find the token in the database
  const tokenDoc = await Token.findOne({ token, isRevoked: false }).populate('user');
  
  if (!tokenDoc) {
    throw new Error('Invalid or expired refresh token');
  }

  // Check if token is expired
  if (tokenDoc.expiresAt < new Date()) {
    // Mark token as revoked
    tokenDoc.isRevoked = true;
    tokenDoc.revokedReason = 'expired';
    await tokenDoc.save();
    
    throw new Error('Refresh token has expired');
  }

  // Check if token was already used (possible token reuse attack)
  if (tokenDoc.used) {
    // Security breach! Revoke all tokens in this family
    await revokeTokenFamily(tokenDoc.family, 'reuse_detected');
    throw new Error('Token reuse detected');
  }

  // Mark this token as used
  tokenDoc.used = true;
  await tokenDoc.save();

  return {
    user: tokenDoc.user,
    tokenDoc,
    family: tokenDoc.family
  };
};

/**
 * Revoke a specific token
 * 
 * @param {String} token - The token to revoke
 * @param {String} reason - Reason for revocation
 * @returns {Boolean} - Success status
 */
const revokeToken = async (token, reason = 'manual_logout') => {
  const update = await Token.updateOne(
    { token },
    { isRevoked: true, revokedReason: reason }
  );
  
  return update.modifiedCount > 0;
};

/**
 * Revoke all tokens in a family
 * 
 * @param {String} family - Token family identifier
 * @param {String} reason - Reason for revocation
 * @returns {Number} - Number of tokens revoked
 */
const revokeTokenFamily = async (family, reason = 'manual_logout') => {
  const update = await Token.updateMany(
    { family },
    { isRevoked: true, revokedReason: reason }
  );
  
  return update.modifiedCount;
};

/**
 * Revoke all tokens for a user
 * 
 * @param {String} userId - User ID
 * @param {String} reason - Reason for revocation
 * @returns {Number} - Number of tokens revoked
 */
const revokeAllUserTokens = async (userId, reason = 'manual_logout') => {
  const update = await Token.updateMany(
    { user: userId },
    { isRevoked: true, revokedReason: reason }
  );
  
  return update.modifiedCount;
};

/**
 * Clean up expired tokens from the database
 * 
 * @returns {Number} - Number of tokens removed
 */
const cleanupExpiredTokens = async () => {
  const update = await Token.updateMany(
    { expiresAt: { $lt: new Date() }, isRevoked: false },
    { isRevoked: true, revokedReason: 'expired' }
  );
  
  return update.modifiedCount;
};

/**
 * Rotate a refresh token by marking the old one as used and creating a new one
 * 
 * @param {String} oldToken - The old refresh token
 * @param {Object} req - Express request object
 * @returns {Object} - Object containing the new access and refresh tokens
 */
const rotateRefreshToken = async (oldToken, req) => {
  try {
    // Verify the old token and get user and family
    const { user, family } = await verifyRefreshToken(oldToken);
    
    // Generate new access token
    const accessToken = generateAccessToken(user);
    
    // Create new refresh token in the same family
    const { plainToken: refreshToken } = await createRefreshToken(user, family, req);
    
    return {
      accessToken,
      refreshToken,
      user
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  generateAccessToken,
  createRefreshToken,
  findRefreshToken,
  verifyRefreshToken,
  revokeToken,
  revokeTokenFamily,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  rotateRefreshToken
}; 