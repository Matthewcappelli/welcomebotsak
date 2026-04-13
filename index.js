const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  PermissionsBitField,
  EmbedBuilder
} = require("discord.js");

const fs = require("fs");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// simple json DB
const dbFile = "./data.json";
let db = {};
if (fs.existsSync(dbFile)) {
  db = JSON.parse(fs.readFileSync(dbFile));
}

// save helper
function saveDB() {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

// slash commands
const commands = [
  new SlashCommandBuilder()
    .setName("setwelcome")
    .setDescription("Set welcome channel")
    .addChannelOption(option =>
      option.setName("channel")
        .setDescription("Welcome channel")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );

  console.log("Slash commands registered");
});

// set welcome channel command
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "setwelcome") {
    const channel = interaction.options.getChannel("channel");

    db[interaction.guild.id] = { welcomeChannel: channel.id };
    saveDB();

    await interaction.reply(`Welcome channel set to ${channel}`);
  }
});

// welcome message
client.on("guildMemberAdd", member => {
  const guildConfig = db[member.guild.id];
  if (!guildConfig) return;

  const channel = member.guild.channels.cache.get(guildConfig.welcomeChannel);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("👋 Welcome!")
    .setDescription(`Welcome **${member.user.username}** to the server!`)
    .setThumbnail(member.user.displayAvatarURL())
    .setColor("#00FF99");

  channel.send({ embeds: [embed] });
});

client.login(process.env.TOKEN);