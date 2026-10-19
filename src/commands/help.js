const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Tampilkan semua perintah yang tersedia"),

  async execute(interaction) {
    const network = process.env.IS_TESTNET === "true" ? "🟡 BSC Testnet" : "🟢 BSC Mainnet";

    const embed = new EmbedBuilder()
      .setColor(0xf0b90b)
      .setTitle("🤖 BNB Chain Discord Bot — Bantuan")
      .setDescription(
        `Bot ini memungkinkan kamu melakukan transaksi onchain di **BNB Chain** langsung dari Discord.\n` +
        `Network aktif: **${network}**`
      )
      .addFields(
        {
          name: "💼 `/balance`",
          value:
            "Cek saldo BNB dan semua token.\n" +
            "`address` — (opsional) alamat wallet yang ingin dicek\n" +
            "`token` — (opsional) cek token spesifik saja",
          inline: false,
        },
        {
          name: "📤 `/send`",
          value:
            "Kirim BNB atau token ke alamat tujuan.\n" +
            "`to` — alamat tujuan (wajib)\n" +
            "`token` — pilih token (wajib)\n" +
            "`amount` — jumlah yang dikirim (wajib)\n" +
            "⚠️ Ada tombol konfirmasi sebelum transaksi dieksekusi.\n" +
            "📄 Nota PDF otomatis di-download setelah transaksi selesai.",
          inline: false,
        },
        {
          name: "📤 `/send-bulk`",
          value:
            "Kirim token ke banyak alamat sekaligus (maks 50).\n" +
            "`token` — pilih token (wajib)\n" +
            "`amount` — jumlah per alamat (wajib)\n" +
            "`addresses` — alamat dipisah koma (wajib)\n" +
            "📄 Laporan PDF otomatis di-download setelah selesai.",
          inline: false,
        },
        {
          name: "🔍 `/tx`",
          value:
            "Lihat riwayat 20 transaksi token terakhir.\n" +
            "`address` — alamat wallet (kosongkan untuk wallet bot)\n" +
            "📄 Riwayat PDF otomatis di-download.",
          inline: false,
        },
        {
          name: "👛 `/wallet`",
          value: "Tampilkan alamat wallet bot untuk menerima deposit.",
          inline: false,
        },
        {
          name: "🪙 `/tokens`",
          value: "Lihat daftar token yang didukung beserta contract address-nya.",
          inline: false,
        },
        {
          name: "❓ `/help`",
          value: "Tampilkan pesan bantuan ini.",
          inline: false,
        }
      )
      .addFields({
        name: "⚠️ Catatan Keamanan",
        value:
          "• Private key bot **tidak pernah** dibagikan melalui Discord\n" +
          "• Selalu cek alamat tujuan sebelum konfirmasi\n" +
          "• Gas fee dibayar otomatis dengan BNB di wallet bot",
      })

    return interaction.reply({ embeds: [embed], flags: ["Ephemeral"] });
  },
};
