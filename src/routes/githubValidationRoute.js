import express from "express";
import GithubClient from "../clients/githubClient.js";

const ACCOUNT_AGE_MINIMUM_DAYS = 30;
const MIN_PUBLIC_REPOS = 1;
const MIN_FOLLOWERS = 0; // optional stricter

const router = express.Router();

const githubClient = new GithubClient();

const daysSince = (date) => {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((new Date() - new Date(date)) / msPerDay);
};

router.get("/gh-validation/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const { data: userData } = await githubClient.request(
      "GET /user/{user_id}",
      {
        user_id: userId,
      }
    );

    const accountAge = daysSince(userData.created_at);
    const validAge = accountAge >= ACCOUNT_AGE_MINIMUM_DAYS;
    const validRepos = userData.public_repos >= MIN_PUBLIC_REPOS;
    const validFollowers = userData.followers >= MIN_FOLLOWERS;
    const isUser = userData.type === "User";

    const valid =
      validAge && validRepos && validFollowers && isUser;

    if (!valid) {
      console.error(
        `Github User ID ${userId} is invalid. Username: ${userData.login}`
      );
    }
    res.status(200).json({ valid });
  } catch (error) {
    console.error("Error calling GitHub API:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
