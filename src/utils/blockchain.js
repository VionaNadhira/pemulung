require("dotenv").config();
const { ethers } = require("ethers");
const { ERC20_ABI } = require("../abi/erc20");
const { getTokenBySymbol } = require("../config/tokens");

// ─── Provider & Wallet ────────────────────────────────────────────────────────

// BNB Chain mainnet: chain ID 56 di-hardcode agar tidak tergantung auto-detect
const BSC_NETWORK = { chainId: 56, name: "bnb" };

// Daftar RPC — primary dari .env, sisanya fallback
const BSC_RPC_LIST = [
  process.env.BNB_RPC_URL,
  "https://bsc-mainnet.nodereal.io/v1/64a9df0874fb4a93b9d0a3849de012d3", // getLogs support (public demo key)
  "https://bsc.publicnode.com",
  "https://1rpc.io/bnb",
  "https://bsc-dataseed1.binance.org/",
  "https://bsc-dataseed2.binance.org/",
  "https://binance.llamarpc.com",
].filter(Boolean).filter((url, i, arr) => arr.indexOf(url) === i); // dedupe

let _provider = null;
let _wallet = null;

/**
 * Buat JsonRpcProvider dengan chain ID di-hardcode (tidak auto-detect).
 * Ini menghindari error "network changed: 1 => 56" dari FallbackProvider.
 */
function makeProvider(rpcUrl) {
  return new ethers.JsonRpcProvider(rpcUrl, BSC_NETWORK, {
    staticNetwork: true, // skip eth_chainId polling
  });
}

/**
 * Dapatkan provider singleton.
 * @returns {ethers.JsonRpcProvider}
 */
function getProvider() {
  if (!_provider) {
    if (!process.env.BNB_RPC_URL)
      throw new Error("BNB_RPC_URL tidak dikonfigurasi di .env");
    _provider = makeProvider(BSC_RPC_LIST[0]);
  }
  return _provider;
}

/**
 * Jalankan fn(provider) dengan fallback ke RPC berikutnya jika timeout/error.
 * @param {(provider: ethers.JsonRpcProvider) => Promise<any>} fn
 */
async function withFallback(fn) {
  let lastErr;
  for (const url of BSC_RPC_LIST) {
    try {
      const provider = makeProvider(url);
      return await fn(provider);
    } catch (err) {
      lastErr = err;
      // Retry untuk semua error jaringang/RPC kecuali error logic di sisi client
      // (alamat salah, saldo kurang, dsb — retry ke RPC lain tidak akan menolong)
      const CLIENT_ERROR_CODES = new Set([
        "INVALID_ARGUMENT",
        "CALL_EXCEPTION",
        "INSUFFICIENT_FUNDS",
        "UNPREDICTABLE_GAS_LIMIT",
        "NONCE_EXPIRED",
        "REPLACEMENT_UNDERPRICED",
        "TRANSACTION_REPLACED",
        "NUMERIC_FAULT",
        "MISSING_ARGUMENT",
        "UNSUPPORTED_OPERATION",
        "ACTION_REJECTED",
      ]);
      const isRetryable = !CLIENT_ERROR_CODES.has(err.code);
      if (!isRetryable) throw err;
    }
  }
  throw lastErr;
}

/**
 * Dapatkan wallet bot yang sudah terhubung ke provider.
 * @returns {ethers.Wallet}
 */
function getWallet() {
  if (!_wallet) {
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey)
      throw new Error("WALLET_PRIVATE_KEY tidak dikonfigurasi di .env");

    const key = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
    _wallet = new ethers.Wallet(key, makeProvider(BSC_RPC_LIST[0]));
  }
  return _wallet;
}

/**
 * Dapatkan alamat wallet bot.
 * @returns {string}
 */
function getBotAddress() {
  return getWallet().address;
}

// ─── Balance ──────────────────────────────────────────────────────────────────

/**
 * Cek saldo BNB native dari sebuah alamat.
 * @param {string} address
 * @returns {Promise<{raw: bigint, formatted: string}>}
 */
async function getBNBBalance(address) {
  const raw = await withFallback((provider) => provider.getBalance(address));
  return {
    raw,
    formatted: ethers.formatEther(raw),
  };
}

/**
 * Cek saldo token ERC20/BEP20 dari sebuah alamat.
 * @param {string} address - Alamat yang dicek
 * @param {string} tokenSymbol - Symbol token (USDT, USDC, dll)
 * @returns {Promise<{raw: bigint, formatted: string, symbol: string, decimals: number}>}
 */
async function getTokenBalance(address, tokenSymbol) {
  const token = getTokenBySymbol(tokenSymbol);
  if (!token) throw new Error(`Token ${tokenSymbol} tidak didukung`);
  if (token.isNative) return getBNBBalance(address);

  const [raw, decimals, symbol] = await withFallback(async (provider) => {
    const contract = new ethers.Contract(token.contract, ERC20_ABI, provider);
    return Promise.all([
      contract.balanceOf(address),
      contract.decimals(),
      contract.symbol(),
    ]);
  });

  return {
    raw,
    formatted: ethers.formatUnits(raw, decimals),
    symbol,
    decimals: Number(decimals),
    contract: token.contract,
  };
}

/**
 * Cek semua saldo token (BNB + semua token terdaftar) untuk satu alamat.
 * @param {string} address
 * @returns {Promise<Array<{symbol, name, formatted, contract}>>}
 */
async function getAllBalances(address) {
  const { SUPPORTED_TOKENS } = require("../config/tokens");
  const results = [];

  const tasks = Object.values(SUPPORTED_TOKENS).map(async (token) => {
    try {
      let formatted;
      if (token.isNative) {
        const bal = await getBNBBalance(address);
        formatted = bal.formatted;
      } else {
        const [raw, decimals] = await withFallback(async (provider) => {
          const contract = new ethers.Contract(token.contract, ERC20_ABI, provider);
          return Promise.all([contract.balanceOf(address), contract.decimals()]);
        });
        formatted = ethers.formatUnits(raw, decimals);
      }

      results.push({
        symbol: token.symbol,
        name: token.name,
        formatted,
        contract: token.contract || "native",
        logo: token.logo,
      });
    } catch {
      results.push({
        symbol: token.symbol,
        name: token.name,
        formatted: "error",
        contract: token.contract || "native",
        logo: token.logo,
      });
    }
  });

  await Promise.all(tasks);

  // Urutkan: BNB dulu, lalu sisanya
  return results.sort((a, b) => {
    if (a.symbol === "BNB") return -1;
    if (b.symbol === "BNB") return 1;
    return a.symbol.localeCompare(b.symbol);
  });
}

// ─── Transfer ─────────────────────────────────────────────────────────────────

/**
 * Kirim BNB native ke alamat tujuan.
 * @param {string} toAddress
 * @param {string|number} amountBNB - Jumlah dalam BNB (bukan wei)
 * @returns {Promise<ethers.TransactionResponse>}
 */
async function sendBNB(toAddress, amountBNB) {
  if (!ethers.isAddress(toAddress)) {
    throw new Error(`Alamat tujuan tidak valid: ${toAddress}`);
  }

  const wallet = getWallet();
  const value = ethers.parseEther(String(amountBNB));

  // Cek saldo cukup (termasuk estimasi gas)
  const balance = await getBNBBalance(wallet.address);
  const gasPrice = (await withFallback((p) => p.getFeeData())).gasPrice;
  const gasLimit = BigInt(21000);
  const gasCost = gasPrice * gasLimit;

  if (balance.raw < value + gasCost) {
    throw new Error(
      `Saldo BNB tidak cukup. Saldo: ${balance.formatted} BNB, Dibutuhkan: ${ethers.formatEther(value + gasCost)} BNB (termasuk gas)`
    );
  }

  const tx = await wallet.sendTransaction({
    to: toAddress,
    value,
    gasLimit,
  });

  return tx;
}

/**
 * Kirim token ERC20/BEP20 ke alamat tujuan.
 * @param {string} toAddress
 * @param {string} tokenSymbol
 * @param {string|number} amount - Jumlah dalam unit token (bukan wei)
 * @returns {Promise<ethers.TransactionResponse>}
 */
async function sendToken(toAddress, tokenSymbol, amount) {
  if (!ethers.isAddress(toAddress)) {
    throw new Error(`Alamat tujuan tidak valid: ${toAddress}`);
  }

  const token = getTokenBySymbol(tokenSymbol);
  if (!token) throw new Error(`Token ${tokenSymbol} tidak didukung`);
  if (token.isNative) return sendBNB(toAddress, amount);

  const wallet = getWallet();
  const contract = new ethers.Contract(token.contract, ERC20_ABI, wallet);

  // Ambil decimals dari kontrak (bukan dari config, untuk akurasi)
  const decimals = await contract.decimals();
  const amountWei = ethers.parseUnits(String(amount), decimals);

  // Cek saldo token cukup
  const tokenBalance = await contract.balanceOf(wallet.address);
  if (tokenBalance < amountWei) {
    const formatted = ethers.formatUnits(tokenBalance, decimals);
    throw new Error(
      `Saldo ${tokenSymbol} tidak cukup. Saldo: ${formatted} ${tokenSymbol}, Dibutuhkan: ${amount} ${tokenSymbol}`
    );
  }

  // Cek saldo BNB untuk gas
  const bnbBalance = await getBNBBalance(wallet.address);
  const gasLimit = BigInt(process.env.DEFAULT_GAS_LIMIT || 100000);
  const gasPrice = (await withFallback((p) => p.getFeeData())).gasPrice;
  const gasCost = gasPrice * gasLimit;

  if (bnbBalance.raw < gasCost) {
    throw new Error(
      `Saldo BNB tidak cukup untuk membayar gas. Saldo: ${bnbBalance.formatted} BNB, Dibutuhkan: ~${ethers.formatEther(gasCost)} BNB`
    );
  }

  const tx = await contract.transfer(toAddress, amountWei, { gasLimit });
  return tx;
}

// ─── Transaction Info ─────────────────────────────────────────────────────────

/**
 * Dapatkan detail transaksi berdasarkan hash.
 * @param {string} txHash
 * @returns {Promise<object>}
 */
async function getTransactionInfo(txHash) {
  const [tx, receipt] = await withFallback((provider) =>
    Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
    ])
  );

  if (!tx) throw new Error(`Transaksi tidak ditemukan: ${txHash}`);

  return {
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    value: ethers.formatEther(tx.value),
    gasPrice: ethers.formatUnits(tx.gasPrice || 0n, "gwei"),
    status: receipt ? (receipt.status === 1 ? "✅ Success" : "❌ Failed") : "⏳ Pending",
    blockNumber: receipt?.blockNumber || null,
    gasUsed: receipt?.gasUsed?.toString() || null,
    confirmations: receipt ? await receipt.confirmations() : 0,
  };
}

/**
 * Tunggu konfirmasi transaksi.
 * @param {ethers.TransactionResponse} tx
 * @param {number} confirmations
 * @returns {Promise<ethers.TransactionReceipt>}
 */
async function waitForConfirmation(tx, confirmations = 1) {
  const required = Number(process.env.REQUIRED_CONFIRMATIONS || confirmations);
  return tx.wait(required);
}

/**
 * Validasi format alamat Ethereum/BNB Chain.
 * @param {string} address
 * @returns {boolean}
 */
function isValidAddress(address) {
  return ethers.isAddress(address);
}

/**
 * Singkat alamat untuk tampilan Discord (0x1234...5678).
 * @param {string} address
 * @returns {string}
 */
function shortAddress(address) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Buat URL explorer untuk tx hash atau address.
 * @param {string} hashOrAddress
 * @param {'tx'|'address'} type
 * @returns {string}
 */
function explorerUrl(hashOrAddress, type = "tx") {
  const isTestnet = process.env.IS_TESTNET === "true";
  const base = isTestnet
    ? "https://testnet.bscscan.com"
    : "https://bscscan.com";
  return `${base}/${type}/${hashOrAddress}`;
}

module.exports = {
  withFallback,
  getProvider,
  getWallet,
  getBotAddress,
  getBNBBalance,
  getTokenBalance,
  getAllBalances,
  sendBNB,
  sendToken,
  getTransactionInfo,
  waitForConfirmation,
  isValidAddress,
  shortAddress,
  explorerUrl,
};
