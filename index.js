require("dotenv").config();
const fs = require("fs");
const path = require("path");

const express = require("express");
const axios = require("axios");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const app = express();

/* ===== ENV ===== */
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;
const REDIRECT_URI = process.env.REDIRECT_URI;

if (!CLIENT_ID || !BOT_TOKEN || !CLIENT_SECRET || !REDIRECT_URI) {
  console.error("❌ متغيرات البيئة ناقصة");
  process.exit(1);
}

/* ===== STORAGE ===== */
const DB_FILE = path.join(__dirname, "oauth.json");

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return {};
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

let oauthUsers = loadDB();

/* ================= OAuth ================= */
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("❌ لم يتم استلام كود التفويض");

  try {
    const token = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        scope: "identify email guilds"
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = token.data.access_token;

    const userRes = await axios.get(
      "https://discord.com/api/users/@me",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const guildsRes = await axios.get(
      "https://discord.com/api/users/@me/guilds",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    oauthUsers[userRes.data.id] = {
      user: userRes.data,
      guilds: guildsRes.data,
      authorizedAt: new Date().toISOString()
    };

    saveDB(oauthUsers);

    res.send("✅ تم التفويض بنجاح، ارجع إلى ديسكورد");
  } catch (err) {
    console.error(err.response?.data || err);
    res.send("❌ فشل التفويض");
  }
});

/* ================= BOT ================= */
const bot = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ===== Slash Commands ===== */
const commands = [
  new SlashCommandBuilder()
    .setName("info")
    .setDescription("معلومات تفويض حساب")
    .addStringOption(opt =>
      opt
        .setName("id")
        .setDescription("ID الحساب")
        .setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

bot.once("ready", async () => {
  console.log(`🤖 Logged in as ${bot.user.tag}`);

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );

  console.log("✅ Slash Commands Registered");
});

/* ===== Interactions ===== */
bot.on("interactionCreate", async (interaction) => {

  /* ---- Slash Command ---- */
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName !== "info") return;

    const userId = interaction.options.getString("id");
    const data = oauthUsers[userId];

    if (!data) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle("❌ الحساب غير مفوّض")
            .setDescription("هذا الحساب لم يقم بتفويض البوت")
        ]
      });
    }

    const u = data.user;

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle("✅ الحساب مفوّض")
      .setThumbnail(
        u.avatar
          ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`
          : null
      )
      .addFields(
        { name: "👤 الاسم", value: u.username, inline: true },
        { name: "📧 الإيميل", value: u.email ?? "غير متوفر", inline: true },
        { name: "🕒 تاريخ التفويض", value: `<t:${Math.floor(new Date(data.authorizedAt).getTime()/1000)}:R>` }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`guilds_${u.id}`)
        .setLabel("📜 السيرفرات")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`user_${u.id}`)
        .setLabel("👤 الحساب")
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }

  /* ---- Buttons ---- */
  if (interaction.isButton()) {
    const [type, userId] = interaction.customId.split("_");
    const data = oauthUsers[userId];
    if (!data) {
      return interaction.reply({ content: "❌ لا توجد بيانات", ephemeral: true });
    }

    if (type === "guilds") {
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle("📜 السيرفرات");

      data.guilds.forEach(g =>
        embed.addFields({
          name: g.name,
          value: `ID: ${g.id}`,
          inline: true
        })
      );

      return interaction.update({ embeds: [embed], components: [] });
    }

    if (type === "user") {
      const u = data.user;

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle("👤 معلومات الحساب")
        .setThumbnail(
          u.avatar
            ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`
            : null
        )
        .addFields(
          { name: "الاسم", value: u.username, inline: true },
          { name: "الإيميل", value: u.email ?? "غير متوفر", inline: true }
        );

      return interaction.update({ embeds: [embed], components: [] });
    }
  }
});

/* ================= START ================= */
bot.login(BOT_TOKEN);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 OAuth server running on port ${PORT}`);
});
