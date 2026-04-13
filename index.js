const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder
} = require("discord.js");

require("dotenv").config();
const pool = require("./db");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ---------------- Slash Commands ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("setwelcomechannel")
    .setDescription("Set the welcome channel")
    .addChannelOption(opt =>
      opt.setName("channel")
        .setDescription("Channel for welcome messages")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("setwelcomeembed")
    .setDescription("Customize the welcome embed")
    .addStringOption(opt =>
      opt.setName("title")
        .setDescription("Embed title")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("description")
        .setDescription("Use \\n for line breaks. Supports {user}, {server}, {count}")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("color")
        .setDescription("Hex color")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  new SlashCommandBuilder()
    .setName("previewwelcome")
    .setDescription("Preview the welcome embed")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
].map(cmd => cmd.toJSON());

// ---------------- Register Commands ----------------
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );

  console.log("Slash commands registered.");
});

// ---------------- Handle Slash Commands ----------------
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guild.id;

  // Set welcome channel
  if (interaction.commandName === "setwelcomechannel") {
    const channel = interaction.options.getChannel("channel");

    await pool.query(
      `INSERT INTO guilds (guild_id, channel_id)
       VALUES ($1,$2)
       ON CONFLICT (guild_id)
       DO UPDATE SET channel_id=$2`,
      [guildId, channel.id]
    );

    return interaction.reply(`Welcome channel set to ${channel}`);
  }

  // Set welcome embed
  if (interaction.commandName === "setwelcomeembed") {
    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const color = interaction.options.getString("color") || "#00FF99";

    await pool.query(
      `INSERT INTO guilds (guild_id, title, description, color)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (guild_id)
       DO UPDATE SET title=$2, description=$3, color=$4`,
      [guildId, title, description, color]
    );

    return interaction.reply("Welcome embed updated.");
  }

  // Preview welcome embed
  if (interaction.commandName === "previewwelcome") {
    const res = await pool.query(
      "SELECT * FROM guilds WHERE guild_id=$1",
      [guildId]
    );

    const data = res.rows[0];

    if (!data || !data.title) {
      return interaction.reply("No welcome embed configured yet.");
    }

    const description = data.description
      .replaceAll("\\n", "\n")
      .replaceAll("{user}", `<@${interaction.user.id}>`)
      .replaceAll("{username}", interaction.user.username)
      .replaceAll("{server}", interaction.guild.name)
      .replaceAll("{count}", interaction.guild.memberCount);

    const embed = new EmbedBuilder()
      .setTitle(data.title)
      .setDescription(description)
      .setColor(data.color)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

// ---------------- Welcome Event ----------------
client.on("guildMemberAdd", async member => {
  const res = await pool.query(
    "SELECT * FROM guilds WHERE guild_id=$1",
    [member.guild.id]
  );

  const data = res.rows[0];
  if (!data || !data.channel_id || !data.title) return;

  const channel = member.guild.channels.cache.get(data.channel_id);
  if (!channel) return;

  const description = data.description
    .replaceAll("\\n", "\n")
    .replaceAll("{user}", `<@${member.id}>`)
    .replaceAll("{username}", member.user.username)
    .replaceAll("{server}", member.guild.name)
    .replaceAll("{count}", member.guild.memberCount);

  const embed = new EmbedBuilder()
    .setTitle(data.title)
    .setDescription(description)
    .setColor(data.color)
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  channel.send({ embeds: [embed] });
});

client.login(process.env.TOKEN);
