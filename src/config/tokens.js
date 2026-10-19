require("dotenv").config();

/**
 * Daftar token yang didukung di BNB Chain
 * Address diambil dari environment variable, dengan fallback ke mainnet default
 */
const SUPPORTED_TOKENS = {
  BNB: {
    symbol: "BNB",
    name: "BNB (Native)",
    decimals: 18,
    contract: null, // native coin, bukan token
    isNative: true,
    logo: "<:bnb:1561223325206839426>",
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 18,
    contract:
      process.env.USDT_CONTRACT ||
      "0x55d398326f99059fF775485246999027B3197955",
    isNative: false,
    logo: "<:usdt:1561223280000630904>",
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 18,
    contract:
      process.env.USDC_CONTRACT ||
      "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    isNative: false,
    logo: "<:usdc:1561223307729047552>",
  },
  FDUSD: {
    symbol: "FDUSD",
    name: "First Digital USD",
    decimals: 18,
    contract:
      process.env.FDUSD_CONTRACT ||
      "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409",
    isNative: false,
    logo: "💵",
  },
  WBNB: {
    symbol: "WBNB",
    name: "Wrapped BNB",
    decimals: 18,
    contract:
      process.env.WBNB_CONTRACT ||
      "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    isNative: false,
    logo: "<:bnb:1561223325206839426>",
  },
};

/**
 * Cari token berdasarkan symbol (case-insensitive)
 * @param {string} symbol
 * @returns {object|null}
 */
function getTokenBySymbol(symbol) {
  if (!symbol) return null;
  const upper = symbol.toUpperCase();
  return SUPPORTED_TOKENS[upper] || null;
}

/**
 * Cari token berdasarkan contract address
 * @param {string} address
 * @returns {object|null}
 */
function getTokenByAddress(address) {
  if (!address) return null;
  const lower = address.toLowerCase();
  return (
    Object.values(SUPPORTED_TOKENS).find(
      (t) => t.contract && t.contract.toLowerCase() === lower
    ) || null
  );
}

/**
 * Daftar symbol semua token yang didukung
 */
function getSupportedSymbols() {
  return Object.keys(SUPPORTED_TOKENS);
}

module.exports = {
  SUPPORTED_TOKENS,
  getTokenBySymbol,
  getTokenByAddress,
  getSupportedSymbols,
};
