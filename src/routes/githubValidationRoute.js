import express from "express";

const ACCOUNT_AGE_MINIMUM_DAYS = 30;
const router = express.Router();

const daysSince = (date) => {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((new Date() - new Date(date)) / msPerDay);
};

router.get('/gh-validation/:userId', async (req, res) => {
    const { userId } = req.params;

    const GH_TOKEN = process.env.GH_TOKEN;
    if (!GH_TOKEN) {
        return res.status(500).json({ error: "GitHub token not configured." });
    }

    try {
        const response = await fetch(`https://api.github.com/user/${userId}`, {
            headers: {
                Authorization: `token ${GH_TOKEN}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            return res.status(response.status).json({ error: error.message || "GitHub API error." });
        }
        const userData = await response.json();
        let valid;

        const accountAge = daysSince(userData.created_at);
        valid = accountAge >= ACCOUNT_AGE_MINIMUM_DAYS;

        if(!valid){
            console.error(`Github User ID ${userId} is invalid. Username: ${userData.login}`)
        }
        res.status(200).json({
            valid,
        });
    } catch (error) {
        console.error("Error calling GitHub API:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

export default router;