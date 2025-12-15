require("dotenv").config();

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

// ===== ENV =====
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;
const REDIRECT_URI = "https://seller-oauth.onrender.com/callback";

// ================= OAuth =================
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
        scope: "identify email"
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const user = await axios.get(
      "https://discord.com/api/users/@me",
      { headers: { Authorization: `Bearer ${token.data.access_token}` } }
    );

    res.send(`
      <h1>✅ نجح التفويض</h1>
      <p><b>الحساب:</b> ${user.data.username}</p>
      <p><b>ID:</b> ${user.data.id}</p>
      <p><b>البريد:</b> ${user.data.email ?? "غير متوفر"}</p>
    `);
  } catch (e) {
    console.error(e.response?.data || e);
    res.send("❌ فشل التفويض");
  }
});

// ================= BOT =================
const bot = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commands = [
  new SlashCommandBuilder().setName("help").setDescription("أوامر البوت"),
  new SlashCommandBuilder().setName("servers").setDescription("سيرفرات البوت"),
  new SlashCommandBuilder().setName("فعل").setDescription("رسالة تفعيل")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

bot.once("ready", async () => {
  console.log(`🤖 Logged in as ${bot.user.tag}`);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("✅ Commands registered");
});

bot.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  if (!i.member.permissions.has(PermissionsBitField.Flags.Administrator))
    return i.reply({ content: "❌ تحتاج Admin", ephemeral: true });

  if (i.commandName === "help") {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle("📘 أوامر Seller Bot")
      .setDescription(
        "**/servers** — السيرفرات\n" +
        "**/فعل** — رسالة التفعيل\n" +
        "**/help** — المساعدة"
      );
    return i.reply({ embeds: [embed], ephemeral: true });
  }

  if (i.commandName === "servers") {
    return i.reply(
      bot.guilds.cache.map(g => `• ${g.name}`).join("\n") || "لا يوجد"
    );
  }

  if (i.commandName === "فعل") {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle("✨ مرحباً بكم في Seller ✨")
      .setDescription("أفضل مكان للتكوين والفعاليات 💛");
    return i.reply({ embeds: [embed] });
  }
});

// ================= START =================
bot.login(BOT_TOKEN);
app.listen(3000, () => console.log("🌐 Seller OAuth Running"));
