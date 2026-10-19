require("dotenv").config();
const { Client, GatewayIntentBits, Collection, Events } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Validasi env wajib sebelum bot berjalan
const REQUIRED_ENV = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "WALLET_PRIVATE_KEY", "BNB_RPC_URL"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Environment variable "${key}" belum dikonfigurasi di .env`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Collection untuk menyimpan semua slash command
client.commands = new Collection();

// Load semua file command dari folder commands/
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Loaded command: /${command.data.name}`);
  } else {
    console.warn(`⚠️  Command file ${file} tidak memiliki data atau execute`);
  }
}

// ─── Event: Bot siap ──────────────────────────────────────────────────────────
client.once(Events.ClientReady, async (c) => {
  console.log(`\n🤖 Bot aktif sebagai: ${c.user.tag}`);
  console.log(`📡 Terhubung ke BNB Chain: ${process.env.BNB_RPC_URL}`);
  console.log(`🌐 Network: ${process.env.IS_TESTNET === "true" ? "Testnet (BSC)" : "Mainnet (BSC)"}`);
  console.log(`📋 Commands loaded: ${client.commands.size}`);

  // Fetch application emojis agar bisa dipakai di embed
  try {
    await c.application.emojis.fetch();
    console.log(`🎨 Application emojis loaded: ${c.application.emojis.cache.size}`);
    c.application.emojis.cache.forEach(e => console.log(`   ${e.toString()} ${e.name}`));
  } catch (err) {
    console.warn("⚠️  Gagal load application emojis:", err.message);
  }
  console.log();
});

// ─── Event: Slash command dieksekusi ─────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`Command tidak ditemukan: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error saat menjalankan /${interaction.commandName}:`, error);

    const errorMessage = {
      content: `❌ Terjadi kesalahan saat menjalankan perintah ini.\n\`\`\`${error.message}\`\`\``,
      flags: ["Ephemeral"],
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// ─── Event: Error handler ────────────────────────────────────────────────────
client.on(Events.Error, (error) => {
  console.error("Discord client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

// Login ke Discord
client.login(process.env.DISCORD_TOKEN);
