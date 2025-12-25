import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { storage } from './storage';
import { generateToken } from './auth';

// Configure Google OAuth Strategy
export function configureGoogleAuth() {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackURL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

    if (!clientID || !clientSecret) {
        console.warn('⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
        return;
    }

    passport.use(new GoogleStrategy({
        clientID,
        clientSecret,
        callbackURL,
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
                return done(new Error('No email found in Google profile'), undefined);
            }

            // Check if user exists
            let user = await storage.getUserByEmail(email);

            if (!user) {
                // Create new user from Google profile
                user = await storage.createUser({
                    email,
                    name: profile.displayName || email.split('@')[0],
                    password: '', // No password for OAuth users
                    googleId: profile.id,
                    profileImageUrl: profile.photos?.[0]?.value,
                });

                // Initialize default categories for new user
                await storage.initializeDefaultCategories(user.id);
                await storage.initializeDefaultUserPreferences(user.id);
            } else if (!user.googleId) {
                // Link Google account to existing user
                await storage.updateUser(user.id, {
                    googleId: profile.id,
                    profileImageUrl: user.profileImageUrl || profile.photos?.[0]?.value,
                });
            }

            return done(null, user);
        } catch (error) {
            return done(error as Error, undefined);
        }
    }));

    // Serialize user for session
    passport.serializeUser((user: any, done) => {
        done(null, user.id);
    });

    // Deserialize user from session
    passport.deserializeUser(async (id: string, done) => {
        try {
            const user = await storage.getUser(id);
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });

    console.log('✅ Google OAuth configured');
}

// Generate JWT token for OAuth user
export function generateOAuthToken(user: any): string {
    return generateToken({
        id: user.id,
        email: user.email || '',
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
    });
}
