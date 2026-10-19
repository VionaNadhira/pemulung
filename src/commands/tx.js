const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { ethers } = require("ethers");
const { getBotAddress, explorerUrl, shortAddress, withFallback } = require("../utils/blockchain");
const { formatAmount } = require("../utils/format");
const { generateTxHistoryPdf } = require("../utils/pdf");

// BSC block time ~0,46 detik (2026), jadi 49.000 block ≈ 6,3 jam saja.
// RPC public membatasi getLogs maks 50.000 block per query → scan per-chunk.
const SCAN_CHUNK = 49000;
const SCAN_CHUNKS = 4; // total 196.000 block ≈ 25 jam
const SCAN_TOTAL = SCAN_CHUNK * SCAN_CHUNKS;

/**
 * Ambil `limit` transaksi token terakhir via eth_getLogs (Transfer event ERC20).
 * Scan dilakukan bertahap per-chunk karena limit range getLogs RPC public.
 */
async function fetchLastTx(address, limit = 20) {
  return withFallback(async (provider) => {
    const currentBlock = await provider.getBlockNumber();
    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    const addrPadded = ethers.zeroPadValue(address.toLowerCase(), 32);

    const allLogs = [];
    // Chunk dari terbaru ke lama; berhenti lebih awal kalau sudah cukup log
    for (let i = 0; i < SCAN_CHUNKS; i++) {
      const toBlock = Math.max(0, currentBlock - i * SCAN_CHUNK);
      const fromBlock = Math.max(0, toBlock - SCAN_CHUNK + 1);
      if (fromBlock > toBlock) break;

      const [logsOut, logsIn] = await Promise.all([
        provider.getLogs({
          fromBlock,
          toBlock,
          topics: [transferTopic, addrPadded],
        }),
        provider.getLogs({
          fromBlock,
          toBlock,
          topics: [transferTopic, null, addrPadded],
        }),
      ]);
      allLogs.push(...logsOut, ...logsIn);

      // Cukup log untuk limit (dengan cadangan karena dedupe bisa buang duplikat)
      if (allLogs.length >= limit * 3) break;
    }

    // Gabung dan urutkan by blockNumber desc
    const deduped = allLogs
      .sort((a, b) => b.blockNumber - a.blockNumber || b.transactionIndex - a.transactionIndex)
      .filter((log, i, arr) => arr.findIndex(l => l.transactionHash === log.transactionHash) === i)
      .slice(0, limit);

    if (deduped.length === 0) return [];

    // Fetch receipt untuk tiap tx
    const txDetails = await Promise.all(
      deduped.map(async (log) => {
        try {
          const [tx, receipt] = await Promise.all([
            provider.getTransaction(log.transactionHash),
            provider.getTransactionReceipt(log.transactionHash),
          ]);
          if (!tx) return null;

          const block = await provider.getBlock(tx.blockNumber);
          const isOut = tx.from?.toLowerCase() === address.toLowerCase();
          // Decode amount dari log data (ERC20 Transfer selalu 32 bytes value)
          let amount = "?";
          try {
            amount = formatAmount(ethers.formatUnits(log.data, 18));
          } catch {}

          return {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            contract: log.address,
            amount,
            isOut,
            status: receipt?.status === 1,
            timestamp: block?.timestamp || 0,
          };
        } catch {
          return null;
        }
      })
    );

    return txDetails.filter(Boolean);
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tx")
    .setDescription("Lihat 20 transaksi token terakhir wallet")
    .addStringOption((opt) =>
      opt
        .setName("address")
        .setDescription("Alamat wallet (kosongkan untuk wallet bot)")
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const addressInput = interaction.options.getString("address");
    const targetAddress = addressInput || getBotAddress();
    const addressUrl = explorerUrl(targetAddress, "address");

    try {
      const txList = await fetchLastTx(targetAddress);

      if (txList.length === 0) {
        return interaction.editReply({
          content: `📭 Tidak ada transaksi token ditemukan untuk [${shortAddress(targetAddress)}](${addressUrl}) dalam ${SCAN_TOTAL.toLocaleString("id-ID")} block terakhir (~25 jam).`,
        });
      }

      const { SUPPORTED_TOKENS } = require("../config/tokens");
      const contractMap = {};
      Object.values(SUPPORTED_TOKENS).forEach((t) => {
        if (t.contract) contractMap[t.contract.toLowerCase()] = t;
      });

      const lines = txList.map((tx) => {
        const txUrl = explorerUrl(tx.hash, "tx");
        const direction = tx.isOut ? "📤" : "📥";
        const status = tx.status ? "✅" : "❌";
        const counterpart = tx.isOut ? tx.to : tx.from;
        const tokenInfo = contractMap[tx.contract?.toLowerCase()];
        const symbol = tokenInfo ? `${tokenInfo.logo} ${tokenInfo.symbol}` : shortAddress(tx.contract);
        const age = timeAgo(tx.timestamp);

        return (
          `${status} ${direction} \`${tx.amount}\` ${symbol}\n` +
          `┗ [${shortAddress(tx.hash)}](${txUrl}) · \`${shortAddress(counterpart)}\` · ${age}`
        );
      });

      let description = lines.join("\n\n");
      if (description.length > 4000) description = description.slice(0, 4000) + "\n…";

      const embed = new EmbedBuilder()
        .setColor(0xf0b90b)
        .setTitle("📋 Transaksi Token Terakhir")
        .setDescription(
          `Wallet: [${shortAddress(targetAddress)}](${addressUrl})\n\n` +
          description
        );

      let pdfAttachment = null;
      try {
        const pdfBuffer = await generateTxHistoryPdf({
          address: targetAddress,
          txList,
        });
        pdfAttachment = { attachment: pdfBuffer, name: `tx-history-${Date.now()}.pdf` };
      } catch (pdfErr) {
        console.warn("Gagal generate PDF tx history:", pdfErr.message);
      }

      const replyPayload = { embeds: [embed] };
      if (pdfAttachment) replyPayload.files = [pdfAttachment];
      return interaction.editReply(replyPayload);
    } catch (error) {
      console.error("Error /tx:", error);
      try { await interaction.deleteReply(); } catch {}
      return interaction.followUp({
        content: `❌ Gagal mengambil data transaksi.\n\`\`\`${error.message}\`\`\``,
        flags: ["Ephemeral"],
      });
    }
  },
};

function timeAgo(ts) {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}d lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}j lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}
