import { Octokit } from "@octokit/rest";

const GH_TOKENS = process.env.GH_TOKENS?.split(',').map(t => t.trim()) || [];
if (!GH_TOKENS.length === 0) {
    throw new Error("GitHub tokens not configured.");
}

class GithubClient {
    constructor() {
        this.clients = GH_TOKENS.map((token) => new Octokit({ auth: token }));
        this.index = 0;
    }

    getCurrentClient() {
        return this.clients[this.index];
    }

    rotateToken() {
        this.index = (this.index + 1) % this.clients.length;
    }

    async request(endpoint, params) {
        let attempts = 0;
        let lastError;
        while (attempts < this.clients.length) {
            const client = this.getCurrentClient();
            try {
                return await client.request(endpoint, params);
            } catch (err) {
                lastError = err;
                // If the error is due to rate limiting, rotate the token
                if (err.status === 403) {
                    console.warn(`Token at index ${this.index} failed with status 403. Rotating token...`);
                    this.rotateToken();
                    attempts++;
                } else {
                    throw err;
                }
            }
        }
        throw lastError || new Error("All GitHub tokens failed");
    }
}

export default GithubClient;