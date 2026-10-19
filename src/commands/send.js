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
  waitForConfirmation,
  isValidAddress,
  getBotAddress,
  getTokenBalance,
  getBNBBalance,
  shortAddress,
  explorerUrl,
} = require("../utils/blockchain");
const { formatAmount } = require("../utils/format");
const { generateSendPdf } = require("../utils/pdf");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("send")
    .setDescription("Kirim BNB atau token ke alamat tujuan")
    .addStringOption((opt) =>
      opt
        .setName("to")
        .setDescription("Alamat tujuan (0x...)")
        .setRequired(true)
    )
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
        .setDescription("Jumlah yang akan dikirim (contoh: 10.5)")
        .setRequired(true)
    ),

  async execute(interaction) {
    const toAddress = interaction.options.getString("to");
    const tokenSymbol = interaction.options.getString("token");
    const amountStr = interaction.options.getString("amount");

    // ── Validasi input ────────────────────────────────────────────────────────

    if (!isValidAddress(toAddress)) {
      return interaction.reply({
        content: `❌ Alamat tujuan tidak valid: \`${toAddress}\``,
        flags: ["Ephemeral"],
      });
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return interaction.reply({
        content: `❌ Jumlah tidak valid: \`${amountStr}\`. Masukkan angka positif.`,
        flags: ["Ephemeral"],
      });
    }

    // Jangan kirim ke diri sendiri
    const botAddress = getBotAddress();
    if (toAddress.toLowerCase() === botAddress.toLowerCase()) {
      return interaction.reply({
        content: "❌ Tidak bisa mengirim ke alamat wallet bot sendiri.",
        flags: ["Ephemeral"],
      });
    }

    await interaction.deferReply();

    try {
      // Ambil saldo sebelum kirim untuk konfirmasi preview
      let currentBalance;
      if (tokenSymbol === "BNB") {
        const bal = await getBNBBalance(botAddress);
        currentBalance = `${formatAmount(bal.formatted)} BNB`;
      } else {
        const bal = await getTokenBalance(botAddress, tokenSymbol);
        currentBalance = `${formatAmount(bal.formatted)} ${tokenSymbol}`;
      }

      const network = process.env.IS_TESTNET === "true" ? "BSC Testnet" : "BSC Mainnet";

      // ── Preview transaksi + tombol konfirmasi ─────────────────────────────
      const previewEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle("⚠️ Konfirmasi Transaksi")
        .setDescription("Periksa detail transaksi sebelum mengkonfirmasi.")
        .addFields(
          { name: "📤 Dari", value: `\`${shortAddress(botAddress)}\``, inline: true },
          { name: "📥 Ke", value: `\`${shortAddress(toAddress)}\``, inline: true },
          { name: "💰 Jumlah", value: `**${amount} ${tokenSymbol}**`, inline: true },
          { name: "💼 Saldo Sekarang", value: currentBalance, inline: true },
          { name: "🌐 Network", value: network, inline: true },
          { name: "⛽ Gas", value: "Otomatis (BNB)", inline: true }
        )

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm_send")
          .setLabel("✅ Konfirmasi Kirim")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("cancel_send")
          .setLabel("❌ Batalkan")
          .setStyle(ButtonStyle.Danger)
      );

      const previewMsg = await interaction.editReply({
        embeds: [previewEmbed],
        components: [confirmRow],
      });

      // ── Tunggu respons tombol ─────────────────────────────────────────────
      let buttonInteraction;
      try {
        buttonInteraction = await previewMsg.awaitMessageComponent({
          filter: (i) => i.user.id === interaction.user.id,
          componentType: ComponentType.Button,
          time: 30_000,
        });
      } catch {
        // Timeout: batalkan
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0x808080)
          .setTitle("⏱️ Transaksi Kadaluarsa")
          .setDescription("Tidak ada konfirmasi dalam 30 detik. Transaksi dibatalkan.");
        return interaction.editReply({ embeds: [timeoutEmbed], components: [] });
      }

      await buttonInteraction.deferUpdate();

      if (buttonInteraction.customId === "cancel_send") {
        const cancelEmbed = new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle("❌ Transaksi Dibatalkan")
          .setDescription("Transaksi dibatalkan oleh pengguna.");
        return interaction.editReply({ embeds: [cancelEmbed], components: [] });
      }

      // ── Proses kirim ──────────────────────────────────────────────────────
      const sendingEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("⏳ Mengirim Transaksi...")
        .setDescription(`Mengirim **${amount} ${tokenSymbol}** ke \`${shortAddress(toAddress)}\`\nMohon tunggu...`);

      await interaction.editReply({ embeds: [sendingEmbed], components: [] });

      // Eksekusi transaksi
      let tx;
      if (tokenSymbol === "BNB") {
        tx = await sendBNB(toAddress, amount);
      } else {
        tx = await sendToken(toAddress, tokenSymbol, amount);
      }

      const txUrl = explorerUrl(tx.hash, "tx");

      // Embed saat tx terkirim (pending)
      const pendingEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle("📡 Transaksi Terkirim — Menunggu Konfirmasi")
        .addFields(
          { name: "📤 Dari", value: `\`${shortAddress(botAddress)}\``, inline: true },
          { name: "📥 Ke", value: `\`${shortAddress(toAddress)}\``, inline: true },
          { name: "💰 Jumlah", value: `**${amount} ${tokenSymbol}**`, inline: true },
          { name: "🔗 TX Hash", value: `[${shortAddress(tx.hash)}](${txUrl})` }
        )

      await interaction.editReply({ embeds: [pendingEmbed], components: [] });

      // Tunggu konfirmasi
      const receipt = await waitForConfirmation(tx);
      const success = receipt.status === 1;

      const finalEmbed = new EmbedBuilder()
        .setColor(success ? 0x00c851 : 0xff4444)
        .setTitle(success ? "✅ Transaksi Berhasil!" : "❌ Transaksi Gagal")
        .addFields(
          { name: "📤 Dari", value: `\`${shortAddress(botAddress)}\``, inline: true },
          { name: "📥 Ke", value: `\`${shortAddress(toAddress)}\``, inline: true },
          { name: "💰 Jumlah", value: `**${amount} ${tokenSymbol}**`, inline: true },
          { name: "🔗 TX Hash", value: `[${shortAddress(tx.hash)}](${txUrl})`, inline: false },
          { name: "📦 Block", value: `#${receipt.blockNumber}`, inline: true },
          { name: "⛽ Gas Used", value: receipt.gasUsed.toString(), inline: true }
        );

      let pdfAttachment = null;
      try {
        const pdfBuffer = await generateSendPdf({
          toAddress,
          tokenSymbol,
          amount,
          hash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          success,
        });
        pdfAttachment = { attachment: pdfBuffer, name: `nota-${tx.hash.slice(0, 8)}.pdf` };
      } catch (pdfErr) {
        console.warn("Gagal generate PDF:", pdfErr.message);
      }

      const replyPayload = { embeds: [finalEmbed], components: [] };
      if (pdfAttachment) replyPayload.files = [pdfAttachment];
      return interaction.editReply(replyPayload);
    } catch (error) {
      console.error("Error /send:", error);
      const errEmbed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle("❌ Transaksi Gagal")
        .setDescription(`\`\`\`${error.message}\`\`\``);
      try { await interaction.deleteReply(); } catch {}
      return interaction.followUp({ embeds: [errEmbed], flags: ["Ephemeral"], components: [] });
    }
  },
};
