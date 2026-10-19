const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const {
  sendToken,
  sendBNB,
  isValidAddress,
  getBotAddress,
  getTokenBalance,
  getBNBBalance,
  shortAddress,
  explorerUrl,
  withFallback,
} = require("../utils/blockchain");
const { getTokenBySymbol } = require("../config/tokens");
const { formatAmount } = require("../utils/format");
const { ethers } = require("ethers");
const { generateBulkPdf } = require("../utils/pdf");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("send-bulk")
    .setDescription("Kirim token ke banyak alamat sekaligus (pisahkan alamat dengan koma)")
    .addStringOption((opt) =>
      opt
        .setName("token")
        .setDescription("Token yang akan dikirim")
        .setRequired(true)
        .addChoices(
          { name: "BNB (Native)", value: "BNB" },
          { name: "USDT", value: "USDT" },
          { name: "USDC", value: "USDC" },
          { name: "FDUSD", value: "FDUSD" },
          { name: "WBNB", value: "WBNB" }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName("amount")
        .setDescription("Jumlah yang dikirim ke SETIAP alamat (contoh: 10.5)")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("addresses")
        .setDescription("Alamat tujuan dipisah koma (contoh: 0xABC...,0xDEF...)")
        .setRequired(true)
    ),

  async execute(interaction) {
    const tokenSymbol = interaction.options.getString("token");
    const amountStr = interaction.options.getString("amount");
    const addressesRaw = interaction.options.getString("addresses");

    // ── Validasi amount ───────────────────────────────────────────────────────
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return interaction.reply({
        content: `❌ Jumlah tidak valid: \`${amountStr}\`. Masukkan angka positif.`,
        flags: ["Ephemeral"],
      });
    }

    // ── Parse dan validasi alamat ─────────────────────────────────────────────
    const botAddress = getBotAddress();
    const rawList = addressesRaw.split(",").map((a) => a.trim()).filter(Boolean);

    if (rawList.length === 0) {
      return interaction.reply({
        content: "❌ Tidak ada alamat yang diberikan.",
        flags: ["Ephemeral"],
      });
    }

    if (rawList.length > 50) {
      return interaction.reply({
        content: `❌ Maksimal 50 alamat sekaligus. Kamu memasukkan ${rawList.length} alamat.`,
        flags: ["Ephemeral"],
      });
    }

    // Validasi semua alamat
    const invalidList = rawList.filter((a) => !isValidAddress(a));
    if (invalidList.length > 0) {
      return interaction.reply({
        content:
          `❌ ${invalidList.length} alamat tidak valid:\n` +
          invalidList.map((a) => `\`${a}\``).join("\n"),
        flags: ["Ephemeral"],
      });
    }

    // Hapus duplikat
    const addresses = [...new Set(rawList.map((a) => a.toLowerCase()))].map(
      (a) => rawList.find((r) => r.toLowerCase() === a)
    );

    // Jangan kirim ke diri sendiri
    if (addresses.some((a) => a.toLowerCase() === botAddress.toLowerCase())) {
      return interaction.reply({
        content: "❌ Daftar alamat tidak boleh mengandung alamat wallet bot sendiri.",
        flags: ["Ephemeral"],
      });
    }

    await interaction.deferReply();

    try {
      const totalAmount = amount * addresses.length;
      const tokenInfo = getTokenBySymbol(tokenSymbol);
      const logo = tokenInfo?.logo || "";

      // Cek saldo sebelum konfirmasi
      let currentBalance;
      if (tokenSymbol === "BNB") {
        const bal = await getBNBBalance(botAddress);
        currentBalance = `${formatAmount(bal.formatted)} BNB`;
      } else {
        const bal = await getTokenBalance(botAddress, tokenSymbol);
        currentBalance = `${formatAmount(bal.formatted)} ${tokenSymbol}`;
      }

      // ── Preview konfirmasi ────────────────────────────────────────────────
      const addrPreview = addresses.slice(0, 5).map((a) => `\`${shortAddress(a)}\``).join(", ");
      const moreText = addresses.length > 5 ? ` +${addresses.length - 5} lainnya` : "";

      const previewEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle("⚠️ Konfirmasi Pengiriman Massal")
        .addFields(
          { name: "Token", value: `${logo} **${tokenSymbol}**`, inline: true },
          { name: "Per Alamat", value: `**${amount} ${tokenSymbol}**`, inline: true },
          { name: "Jumlah Alamat", value: `**${addresses.length}**`, inline: true },
          { name: "Total Kirim", value: `**${formatAmount(totalAmount.toString())} ${tokenSymbol}**`, inline: true },
          { name: "Saldo Sekarang", value: currentBalance, inline: true },
          { name: "Alamat Tujuan", value: addrPreview + moreText, inline: false }
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm_bulk")
          .setLabel(`✅ Kirim ke ${addresses.length} Alamat`)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("cancel_bulk")
          .setLabel("❌ Batalkan")
          .setStyle(ButtonStyle.Danger)
      );

      const previewMsg = await interaction.editReply({ embeds: [previewEmbed], components: [row] });

      // ── Tunggu konfirmasi ─────────────────────────────────────────────────
      let btn;
      try {
        btn = await previewMsg.awaitMessageComponent({
          filter: (i) => i.user.id === interaction.user.id,
          componentType: ComponentType.Button,
          time: 30_000,
        });
      } catch {
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0x808080)
          .setTitle("⏱️ Kadaluarsa")
          .setDescription("Tidak ada konfirmasi dalam 30 detik. Dibatalkan.");
        return interaction.editReply({ embeds: [timeoutEmbed], components: [] });
      }

      await btn.deferUpdate();

      if (btn.customId === "cancel_bulk") {
        const cancelEmbed = new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle("❌ Dibatalkan")
          .setDescription("Pengiriman massal dibatalkan.");
        return interaction.editReply({ embeds: [cancelEmbed], components: [] });
      }

      // ── Mulai proses kirim ────────────────────────────────────────────────
      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < addresses.length; i++) {
        const toAddress = addresses[i];

        // Update progress setiap tx
        const progressEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("⏳ Mengirim...")
          .setDescription(
            `Progress: **${i + 1} / ${addresses.length}**\n` +
            `✅ Berhasil: ${successCount} · ❌ Gagal: ${failCount}\n\n` +
            `Mengirim ke \`${shortAddress(toAddress)}\`...`
          );

        await interaction.editReply({ embeds: [progressEmbed], components: [] });

        try {
          let tx;
          if (tokenSymbol === "BNB") {
            tx = await sendBNB(toAddress, amount);
          } else {
            tx = await sendToken(toAddress, tokenSymbol, amount);
          }

          // Tunggu 1 konfirmasi
          const receipt = await tx.wait(1);
          const success = receipt.status === 1;

          results.push({
            address: toAddress,
            hash: tx.hash,
            success,
          });

          if (success) successCount++;
          else failCount++;
        } catch (err) {
          results.push({
            address: toAddress,
            hash: null,
            success: false,
            error: err.message,
          });
          failCount++;
        }
      }

      // ── Hasil akhir ───────────────────────────────────────────────────────
      const resultLines = results.map((r) => {
        if (r.success) {
          const txUrl = explorerUrl(r.hash, "tx");
          return `✅ \`${shortAddress(r.address)}\` → [${shortAddress(r.hash)}](${txUrl})`;
        } else {
          const reason = r.error
            ? r.error.split("\n")[0].slice(0, 60)
            : "Gagal";
          return `❌ \`${shortAddress(r.address)}\` — ${reason}`;
        }
      });

      let resultDesc = resultLines.join("\n");
      if (resultDesc.length > 3800) resultDesc = resultDesc.slice(0, 3800) + "\n…";

      const finalEmbed = new EmbedBuilder()
        .setColor(failCount === 0 ? 0x00c851 : successCount === 0 ? 0xff4444 : 0xffa500)
        .setTitle("📊 Hasil Pengiriman Massal")
        .addFields(
          { name: "✅ Berhasil", value: `${successCount}`, inline: true },
          { name: "❌ Gagal", value: `${failCount}`, inline: true },
          { name: "📦 Total", value: `${addresses.length}`, inline: true }
        )
        .setDescription(resultDesc);

      let pdfAttachment = null;
      try {
        const pdfBuffer = await generateBulkPdf({
          tokenSymbol,
          amountPerAddress: amount,
          results,
          successCount,
          failCount,
        });
        pdfAttachment = { attachment: pdfBuffer, name: `bulk-${Date.now()}.pdf` };
      } catch (pdfErr) {
        console.warn("Gagal generate PDF bulk:", pdfErr.message);
      }

      const replyPayload = { embeds: [finalEmbed], components: [] };
      if (pdfAttachment) replyPayload.files = [pdfAttachment];
      return interaction.editReply(replyPayload);
    } catch (error) {
      console.error("Error /send-bulk:", error);
      try { await interaction.deleteReply(); } catch {}
      return interaction.followUp({
        content: `❌ Terjadi kesalahan.\n\`\`\`${error.message}\`\`\``,
        flags: ["Ephemeral"],
      });
    }
  },
};
