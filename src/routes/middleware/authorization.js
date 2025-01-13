import { OAuth2Client } from 'google-auth-library';

const oAuth2Client = new OAuth2Client();

const validateGoogleToken = async (req, res, next) => {
    if(process.env.POSTGRES_STRING) {
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