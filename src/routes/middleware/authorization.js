import { OAuth2Client } from 'google-auth-library';

const oAuth2Client = new OAuth2Client();

// Explicit opt-out for local dev. Read once at module load so a misconfigured
// production deploy fails fast instead of silently serving requests with no
// auth — historically this was tied to POSTGRES_STRING, which made "what DB
// am I pointing at" double as "is auth on", a footgun if someone ever set
// POSTGRES_STRING in prod for migration/debug.
const AUTH_DISABLED = process.env.AUTH_DISABLED === 'true';
if (AUTH_DISABLED && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_DISABLED=true is not permitted when NODE_ENV=production.');
}
if (AUTH_DISABLED) {
    console.warn('[auth] AUTH_DISABLED=true — Google token validation is bypassed for ALL /api requests. Local development only.');
}

const validateGoogleToken = async (req, res, next) => {
    if (AUTH_DISABLED) {
        return next();
    }

    const authHeader = req.header('Authorization');
    if (!authHeader) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1]; // Bearer <token>
    try {
        // Verify the access token's payload:
        const tokenInfo = await oAuth2Client.getTokenInfo(token);

        if (tokenInfo.email !== `solana-devnet-faucet-fe@${process.env.PROJECT_ID}.iam.gserviceaccount.com`) {
            return res.status(403).json({ message: 'Forbidden: Invalid audience' });
        }

        // Proceed if valid token
        req.user = tokenInfo; // Attach tokenInfo data (like subject) to req.user
        next();
    } catch (error) {
        console.log("Error with Auth", error);
        res.status(403).json({ message: 'Forbidden' });
    }
};

export { validateGoogleToken };