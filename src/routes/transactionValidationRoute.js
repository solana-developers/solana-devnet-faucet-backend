import express from "express";
import GithubClient from "../clients/githubClient.js";
import transactions from "../db/transactions.js";

const GH_ACCOUNT_AGE_MINIMUM_DAYS = 30;
const GH_MIN_PUBLIC_REPOS = 1;
const GH_MIN_FOLLOWERS = 0; // optional stricter

const TRANSACTION_IP_LIMIT = 200;
const TRANSACTION_WALLET_LIMIT = 100;
const TRANSACTION_GITHUB_LIMIT = 100;
const TRANSACTION_MONTHLY_LIMIT = 50;

const router = express.Router();

const githubClient = new GithubClient();

const daysSince = (date) => {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((new Date() - new Date(date)) / msPerDay);
};

const validGithubAccount = async (github_id) => {
    const {data: userData} = await githubClient.request(
        "GET /user/{github_id}",
        {github_id}
    );

    const accountAge = daysSince(userData.created_at);
    const validAge = accountAge >= GH_ACCOUNT_AGE_MINIMUM_DAYS;
    const validRepos = userData.public_repos >= GH_MIN_PUBLIC_REPOS;
    const validFollowers = userData.followers >= GH_MIN_FOLLOWERS;
    const isUser = userData.type === "User";

    return validAge && validRepos && validFollowers && isUser;
};

const validTransactionHistory = async (ip_address, wallet_address, github_id) => {
    const stats = await transactions.getTransactionStats({ ip_address, wallet_address, github_id });
    const comboCount = await transactions.getMonthlyTransactionStats({ ip_address, wallet_address, github_id });

    const ipValid = Number(stats.ip_count) < TRANSACTION_IP_LIMIT;
    const walletValid = Number(stats.wallet_count) < TRANSACTION_WALLET_LIMIT;
    const githubValid = Number(stats.github_count) < TRANSACTION_GITHUB_LIMIT;
    const comboValid = comboCount < TRANSACTION_MONTHLY_LIMIT;

    return ipValid && walletValid && githubValid && comboValid;
};

router.post("/validate", async (req, res) => {
    const {ip_address, wallet_address, github_id} = req.body;

    try {
        if(!await validGithubAccount(github_id)) {
            console.error(
                `Github User ID ${userId} is invalid.`
            );
            return res.status(200).json({
                valid: false,
                reason: "Github account is invalid"
            });
        }

        if(!await validTransactionHistory(ip_address, wallet_address, github_id)) {
            console.error(
                `Transaction history is invalid.`
            );
            return res.status(200).json({
                valid: false,
                reason: "Transaction history is invalid"
            });
        }

        res.status(200).json({
            valid: true,
            reason: ""
        });
    } catch (error) {
        console.error("Error while validating:", error);
        if(error.status) {
            res.status(error.status).json({valid: false, reason: error.message});
        } else {
            res.status(500).json({valid: false, reason: "Internal server error."});
        }
    }
});

export default router;
