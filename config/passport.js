const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../models/User');

// JWT options
const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'your_jwt_secret_should_be_at_least_32_characters'
};

// Initialize passport with JWT strategy
module.exports = () => {
  passport.use(
    new JwtStrategy(opts, async (jwt_payload, done) => {
      try {
        // Find the user by ID from JWT payload
        const user = await User.findById(jwt_payload.id);
        
        if (user) {
          return done(null, user);
        }
        
        return done(null, false);
      } catch (err) {
        console.error('Error in JWT strategy:', err);
        return done(err, false);
      }
    })
  );
}; 