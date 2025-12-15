require('dotenv').config(); // مهم جدًا لقراءة المتغيرات من Environment Variables

const express = require("express");
const axios = require("axios");
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const app = express();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;
const REDIRECT_URI = "https://yellow-1-do42.onrender.com/callback";

// ================= OAuth =================
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("❌ لم يتم استلام كود التفويض");

  try {
    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenResponse.data.access_token;

    const user = await axios.get(
      "https://discord.com/api/users/@me",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    res.send(`✅ نجح التفويض<br>اسم الحساب: ${user.data.username}`);
  } catch {
    res.send("❌ فشل التفويض");
  }
});

// ================= BOT =================
const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const PREFIX = "$";

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder()
    .setName("servers")
    .setDescription("عرض السيرفرات التي البوت داخلها"),

  new SlashCommandBuilder()
    .setName("invites")
    .setDescription("إنشاء روابط دعوة للسيرفرات"),

  new SlashCommandBuilder()
    .setName("فعل")
    .setDescription("إرسال رسالة تفعيل السيرفر"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("عرض أوامر البوت")
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

bot.once("ready", async () => {
  console.log(`🤖 Logged in as ${bot.user.tag}`);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("✅ Slash commands registered");
});

// ================= SLASH HANDLER =================
bot.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: "❌ تحتاج صلاحية Administrator", ephemeral: true });
  }

  const cmd = interaction.commandName;

  if (cmd === "servers") {
    const servers = bot.guilds.cache.map(g => `• ${g.name}`);
    return interaction.reply(`📌 السيرفرات:\n${servers.join("\n")}`);
  }

  if (cmd === "invites") {
    let text = "";
    for (const guild of bot.guilds.cache.values()) {
      try {
        const channel = guild.channels.cache.find(
          c => c.isTextBased() &&
          c.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.CreateInstantInvite)
        );
        if (!channel) continue;
        const invite = await channel.createInvite({ maxAge: 0 });
        text += `🔗 ${guild.name}: ${invite.url}\n`;
      } catch {}
    }
    return interaction.reply(text || "❌ لا توجد روابط");
  }

  if (cmd === "فعل") {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle("✨ فعل نفسك ✨")
      .setDescription(
        "مرحباً في سيرفر يلو تيم 💛\n\n" +
        "أفضل سيرفر حرق كريديت 💸\n" +
        "وتكوين أصدقاء 🤝\n" +
        "وفعاليات 🎉\n\n" +
        "نتمنى لكم وقتاً ممتعاً ✨"
      )
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }));
    return interaction.reply({ embeds: [embed] });
  }

  if (cmd === "help") {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(`📘 أوامر البوت - ${interaction.guild.name}`)
      .setDescription(
        "✨ **/servers** أو `$servers` - عرض السيرفرات التي البوت داخلها\n" +
        "✨ **/invites** أو `$invites` - إنشاء روابط دعوة للسيرفرات\n" +
        "✨ **/فعل** أو `$فعل` - إرسال رسالة تفعيل السيرفر"
      )
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setFooter({ text: "Yellow Team Bot", iconURL: interaction.guild.iconURL({ dynamic: true }) });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

// ================= PREFIX ALIAS =================
bot.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;
  if (!msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  const cmd = msg.content.slice(1).toLowerCase();
  if (cmd === "help") {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(`📘 أوامر البوت - ${msg.guild.name}`)
      .setDescription(
        "✨ **/servers** أو `$servers`\n" +
        "✨ **/invites** أو `$invites`\n" +
        "✨ **/فعل** أو `$فعل`"
      )
      .setThumbnail(msg.guild.iconURL({ dynamic: true }))
      .setFooter({ text: "Yellow Team Bot", iconURL: msg.guild.iconURL({ dynamic: true }) });

    msg.reply({ embeds: [embed] });
  }
});

// ================= START =================
bot.login(BOT_TOKEN);
app.listen(3000, () => console.log("🌐 Server running"));
