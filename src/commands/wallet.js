const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getBotAddress, explorerUrl } = require("../utils/blockchain");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wallet")
    .setDescription("Tampilkan alamat wallet bot untuk menerima deposit"),

  async execute(interaction) {
    const address = getBotAddress();
    const network = process.env.IS_TESTNET === "true" ? "BSC Testnet" : "BSC Mainnet";
    const addressUrl = explorerUrl(address, "address");

    const embed = new EmbedBuilder()
      .setColor(0xf0b90b)
      .setTitle("👛 Alamat Wallet Bot")
      .setDescription(
        `Kirim BNB atau token BEP-20 ke alamat berikut:\n\n` +
        `\`\`\`${address}\`\`\`\n` +
        `[Lihat di BscScan](${addressUrl})`
      )
      .addFields(
        { name: "🌐 Network", value: network, inline: true },
        { name: "🔗 Chain", value: "BNB Chain (BEP-20)", inline: true }
      )

    return interaction.reply({ embeds: [embed] });
  },
};
