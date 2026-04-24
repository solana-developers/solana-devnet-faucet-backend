/**
 * Truncates an address to "XXXX...XXXX" format for safe logging.
 * Returns "[invalid]" for non-string or empty input.
 *
 * @param {string} address
 * @param {number} [chars=4] - Number of characters to keep on each side
 * @returns {string}
 */
export function truncateAddress(address, chars = 4) {
    if (typeof address !== "string" || address.length === 0) {
        return "[invalid]";
    }
    if (chars <= 0 || address.length <= chars * 2) {
        return address;
    }
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
