require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error("❌ DISCORD_TOKEN dan DISCORD_CLIENT_ID wajib diisi di .env");
  process.exit(1);
}

// Kumpulkan semua command data
const commands = [];
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data) {
    commands.push(command.data.toJSON());
    console.log(`📦 Preparing command: /${command.data.name}`);
  }
}

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`\n🚀 Mendaftarkan ${commands.length} slash command(s)...`);

    let data;
    if (guildId) {
      // Deploy ke guild spesifik (langsung aktif, cocok untuk development)
      data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log(`✅ ${data.length} command berhasil didaftarkan ke Guild ID: ${guildId}`);
    } else {
      // Deploy global (butuh ~1 jam untuk aktif)
      data = await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
      console.log(`✅ ${data.length} command berhasil didaftarkan secara global`);
      console.log("⏳ Global commands membutuhkan waktu ~1 jam untuk aktif");
    }
  } catch (error) {
    console.error("❌ Gagal mendaftarkan commands:", error);
    process.exit(1);
  }
})();
