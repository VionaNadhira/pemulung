const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  getAllBalances,
  getBotAddress,
  isValidAddress,
  explorerUrl,
  shortAddress,
} = require("../utils/blockchain");
const { formatAmount } = require("../utils/format");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Cek semua saldo token di wallet")
    .addStringOption((opt) =>
      opt
        .setName("address")
        .setDescription("Alamat wallet yang ingin dicek (kosongkan untuk cek wallet bot)")
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const addressInput = interaction.options.getString("address");
    let targetAddress;
    let isBot = false;

    if (addressInput) {
      if (!isValidAddress(addressInput)) {
        return interaction.editReply({
          content: `❌ Alamat tidak valid: \`${addressInput}\``,
        });
      }
      targetAddress = addressInput;
    } else {
      targetAddress = getBotAddress();
      isBot = true;
    }

    try {
      const balances = await getAllBalances(targetAddress);
      const addressUrl = explorerUrl(targetAddress, "address");

      const embed = new EmbedBuilder()
        .setColor(0xf0b90b)
        .setTitle("💼 Saldo Wallet")
        .setDescription(`[${shortAddress(targetAddress)}](${addressUrl})${isBot ? " *(Bot)*" : ""}`);

      for (const bal of balances) {
        embed.addFields({
          name: bal.symbol,
          value: `${bal.logo} \`${formatAmount(bal.formatted)}\``,
          inline: true,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error /balance:", error);
      try { await interaction.deleteReply(); } catch {}
      return interaction.followUp({
        content: `❌ Gagal mengambil saldo.\n\`\`\`${error.message}\`\`\``,
        flags: ["Ephemeral"],
      });
    }
  },
};
