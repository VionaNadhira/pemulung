const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { SUPPORTED_TOKENS } = require("../config/tokens");
const { explorerUrl } = require("../utils/blockchain");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tokens")
    .setDescription("Lihat daftar token yang didukung di BNB Chain"),

  async execute(interaction) {
    const network = process.env.IS_TESTNET === "true" ? "BSC Testnet" : "BSC Mainnet";

    const embed = new EmbedBuilder()
      .setColor(0xf0b90b)
      .setTitle("🪙 Token yang Didukung")
      .setDescription(`Berikut daftar token BEP-20 yang dapat digunakan di bot ini.\nNetwork: **${network}**`)

    for (const token of Object.values(SUPPORTED_TOKENS)) {
      const contractInfo = token.isNative
        ? "*Native Coin*"
        : `[\`${token.contract.slice(0, 6)}...${token.contract.slice(-4)}\`](${explorerUrl(token.contract, "address")})`;

      embed.addFields({
        name: `${token.logo} ${token.symbol} — ${token.name}`,
        value: `Kontrak: ${contractInfo}\nDecimals: \`${token.decimals}\``,
        inline: false,
      });
    }

    return interaction.reply({ embeds: [embed] });
  },
};
