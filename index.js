require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const axios = require("axios");
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
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

if (!CLIENT_ID || !CLIENT_SECRET || !BOT_TOKEN || !REDIRECT_URI) {
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
    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        scope: "identify email guilds guilds.members.read"
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenResponse.data.access_token;

    const user = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const guilds = await axios.get("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    oauthUsers[user.data.id] = {
      user: user.data,
      guilds: guilds.data,
      authorizedAt: new Date().toISOString()
    };

    saveDB(oauthUsers);

    res.send(`
      <h1>✅ نجح التفويض</h1>
      <p><b>الحساب:</b> ${user.data.username}</p>
      <p><b>ID:</b> ${user.data.id}</p>
      <p><b>البريد:</b> ${user.data.email ?? "غير متوفر"}</p>
      <p><b>السيرفرات:</b></p>
      <ul>${guilds.data.map(g => `<li>${g.name} (ID: ${g.id})</li>`).join("")}</ul>
    `);
  } catch (e) {
    console.error(e.response?.data || e);
    res.send("❌ فشل التفويض (تحقق من Redirect / Secret)");
  }
});

/* ================= BOT ================= */
const bot = new Client({ intents: [GatewayIntentBits.Guilds] });

const slashCommands = [
  new SlashCommandBuilder().setName("help").setDescription("أوامر البوت"),
  new SlashCommandBuilder().setName("servers").setDescription("سيرفرات البوت"),
  new SlashCommandBuilder().setName("فعل").setDescription("رسالة تفعيل"),
  new SlashCommandBuilder()
    .setName("info")
    .setDescription("معلومات حساب مفوض")
    .addStringOption(o => o.setName("id").setDescription("ID الحساب").setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

bot.once("ready", async () => {
  console.log(`🤖 Logged in as ${bot.user.tag}`);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommands });
  console.log("✅ All Slash Commands Registered");
});

/* ===== Interactions ===== */
bot.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const replyNoData = { content: "❌ لا توجد بيانات", ephemeral: true };

  /* ===== INFO ===== */
  if (i.isChatInputCommand() && i.commandName === "info") {
    const userId = i.options.getString("id");
    const data = oauthUsers[userId];

    if (!data) return i.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle("❌ الحساب غير مفوّض")] });

    const u = data.user;
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle("✅ الحساب مفوّض")
      .setThumbnail(u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : null)
      .addFields(
        { name: "👤 الاسم", value: u.username, inline: true },
        { name: "📧 الإيميل", value: u.email ?? "غير متوفر", inline: true },
        { name: "🕒 تاريخ التفويض", value: `<t:${Math.floor(new Date(data.authorizedAt).getTime()/1000)}:R>` }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`guilds_${u.id}`).setLabel("📜 السيرفرات").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`user_${u.id}`).setLabel("👤 الحساب").setStyle(ButtonStyle.Secondary)
    );

    return i.reply({ embeds: [embed], components: [row] });
  }

  /* ===== HELP ===== */
  if (i.isChatInputCommand() && i.commandName === "help") {
    return i.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle("📘 أوامر البوت").setDescription("/info /servers /فعل /help")] });
  }

  /* ===== SERVERS ===== */
  if (i.isChatInputCommand() && i.commandName === "servers") {
    return i.reply(bot.guilds.cache.map(g => `• ${g.name}`).join("\n") || "لا يوجد");
  }

  /* ===== فَعّل ===== */
  if (i.isChatInputCommand() && i.commandName === "فعل") {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle("✨ مرحباً بكم في Yellow Team ✨")
      .setDescription("أفضل سيرفر للفعاليات\n🔥 حرق كريديت\n🤝 تعرف على أصحاب السيرفر\nنتمنى لكم وقتاً ممتعاً!")
      .setImage("https://i.imgur.com/yourServerImage.png"); // ضع رابط صورة السيرفر هنا

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("تفعيل الحساب")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=email+guilds+guilds.members.read+identify`)
    );

    return i.reply({ embeds: [embed], components: [row] });
  }

  /* ===== BUTTONS ===== */
  if (i.isButton()) {
    const [type, userId] = i.customId.split("_");
    const data = oauthUsers[userId];
    if (!data) return i.reply(replyNoData);

    if (type === "guilds") {
      const embed = new EmbedBuilder().setColor(0xFFD700).setTitle("📜 السيرفرات");
      data.guilds.forEach(g => embed.addFields({ name: g.name, value: `ID: ${g.id}`, inline: true }));
      return i.update({ embeds: [embed], components: [] });
    }

    if (type === "user") {
      const u = data.user;
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle("👤 معلومات الحساب")
        .setThumbnail(u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : null)
        .addFields(
          { name: "الاسم", value: u.username, inline: true },
          { name: "الإيميل", value: u.email ?? "غير متوفر", inline: true }
        );
      return i.update({ embeds: [embed], components: [] });
    }
  }
});

/* ================= START SERVER ================= */
bot.login(BOT_TOKEN);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 OAuth running on port ${PORT}`));
const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

bot.once("ready", async () => {
  console.log(`🤖 Logged in as ${bot.user.tag}`);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommands });
  console.log("✅ All Slash Commands Registered");
});

/* ===== Interactions ===== */
bot.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const replyNoData = { content: "❌ لا توجد بيانات", ephemeral: true };

  /* ===== INFO ===== */
  if (i.isChatInputCommand() && i.commandName === "info") {
    const userId = i.options.getString("id");
    const data = oauthUsers[userId];

    if (!data) return i.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle("❌ الحساب غير مفوّض")], ephemeral: true });

    const u = data.user;
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle("✅ الحساب مفوّض")
      .setThumbnail(u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : null)
      .addFields(
        { name: "👤 الاسم", value: u.username, inline: true },
        { name: "📧 الإيميل", value: u.email ?? "غير متوفر", inline: true },
        { name: "🕒 تاريخ التفويض", value: `<t:${Math.floor(new Date(data.authorizedAt).getTime()/1000)}:R>` }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`guilds_${u.id}`).setLabel("📜 السيرفرات").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`user_${u.id}`).setLabel("👤 الحساب").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`changeAvatar_${u.id}`).setLabel("🖼️ تغيير الافاتار").setStyle(ButtonStyle.Success)
    );

    return i.reply({ embeds: [embed], components: [row], ephemeral: false });
  }

  /* ===== HELP ===== */
  if (i.isChatInputCommand() && i.commandName === "help") {
    return i.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle("📘 أوامر البوت").setDescription("/info /servers /فعل /help")] });
  }

  /* ===== SERVERS ===== */
  if (i.isChatInputCommand() && i.commandName === "servers") {
    return i.reply(bot.guilds.cache.map(g => `• ${g.name}`).join("\n") || "لا يوجد");
  }

  /* ===== فَعّل ===== */
  if (i.isChatInputCommand() && i.commandName === "فعل") {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle("✨ مرحباً بكم في Yellow Team ✨")
      .setDescription("أفضل سيرفر للفعاليات\n🔥 حرق كريديت\n🤝 تعرف على أصحاب السيرفر\nنتمنى لكم وقتاً ممتعاً!")
      .setImage("https://i.imgur.com/yourServerImage.png");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("تفعيل الحساب")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=email+guilds+guilds.members.read+identify`)
    );

    return i.reply({ embeds: [embed], components: [row] });
  }

  /* ===== BUTTONS ===== */
  if (i.isButton()) {
    const [type, userId] = i.customId.split("_");
    const data = oauthUsers[userId];
    if (!data) return i.reply(replyNoData);

    if (type === "guilds") {
      const embed = new EmbedBuilder().setColor(0xFFD700).setTitle("📜 السيرفرات");
      data.guilds.forEach(g => embed.addFields({ name: g.name, value: `ID: ${g.id}`, inline: true }));
      return i.update({ embeds: [embed], components: [] });
    }

    if (type === "user") {
      const u = data.user;
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle("👤 معلومات الحساب")
        .setThumbnail(u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : null)
        .addFields(
          { name: "الاسم", value: u.username, inline: true },
          { name: "الإيميل", value: u.email ?? "غير متوفر", inline: true }
        );
      return i.update({ embeds: [embed], components: [] });
    }

    if (type === "changeAvatar") {
      await i.reply({ content: "🔗 أرسل رابط الصورة الجديدة للأفاتار:", ephemeral: true });

      const filter = m => m.author.id === i.user.id;
      const collector = i.channel.createMessageCollector({ filter, max: 1, time: 60000 });

      collector.on("collect", msg => {
        const url = msg.content.trim();
        data.user.avatar = url;
        saveDB(oauthUsers);

        i.followUp({ content: "✅ تم تحديث الافاتار بنجاح!", ephemeral: true });

        const embed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle("✅ الحساب مفوّض")
          .setThumbnail(url)
          .addFields(
            { name: "👤 الاسم", value: data.user.username, inline: true },
            { name: "📧 الإيميل", value: data.user.email ?? "غير متوفر", inline: true },
            { name: "🕒 تاريخ التفويض", value: `<t:${Math.floor(new Date(data.authorizedAt).getTime()/1000)}:R>` }
          );

        i.message.edit({ embeds: [embed] });
      });

      collector.on("end", collected => {
        if (collected.size === 0) i.followUp({ content: "❌ لم يتم إدخال رابط صورة", ephemeral: true });
      });
    }
  }
});

/* ================= START SERVER ================= */
bot.login(BOT_TOKEN);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 OAuth running on port ${PORT}`));
const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

bot.once("ready", async () => {
  console.log(`🤖 Logged in as ${bot.user.tag}`);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommands });
  console.log("✅ All Slash Commands Registered");
});

/* ===== Interactions ===== */
bot.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const replyNoData = { content: "❌ لا توجد بيانات", ephemeral: true };

  /* ===== INFO ===== */
  if (i.isChatInputCommand() && i.commandName === "info") {
    const userId = i.options.getString("id");
    const data = oauthUsers[userId];

    if (!data) return i.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle("❌ الحساب غير مفوّض")] });

    const u = data.user;
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle("✅ الحساب مفوّض")
      .setThumbnail(u.avatar ? u.avatar : null)
      .addFields(
        { name: "👤 الاسم", value: u.username, inline: true },
        { name: "📧 الإيميل", value: u.email ?? "غير متوفر", inline: true },
        { name: "🕒 تاريخ التفويض", value: `<t:${Math.floor(new Date(data.authorizedAt).getTime()/1000)}:R>` }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`guilds_${u.id}`).setLabel("📜 السيرفرات").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`user_${u.id}`).setLabel("👤 الحساب").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`changeAvatar_${u.id}`).setLabel("🖼️ تغيير الافاتار").setStyle(ButtonStyle.Success)
    );

    return i.reply({ embeds: [embed], components: [row] });
  }

  /* ===== HELP ===== */
  if (i.isChatInputCommand() && i.commandName === "help") {
    return i.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle("📘 أوامر البوت").setDescription("/info /servers /فعل /help")] });
  }

  /* ===== SERVERS ===== */
  if (i.isChatInputCommand() && i.commandName === "servers") {
    return i.reply(bot.guilds.cache.map(g => `• ${g.name}`).join("\n") || "لا يوجد");
  }

  /* ===== فَعّل ===== */
  if (i.isChatInputCommand() && i.commandName === "فعل") {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle("✨ مرحباً بكم في Yellow Team ✨")
      .setDescription("أفضل سيرفر للفعاليات\n🔥 حرق كريديت\n🤝 تعرف على أصحاب السيرفر\nنتمنى لكم وقتاً ممتعاً!")
      .setImage("https://i.imgur.com/yourServerImage.png");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("تفعيل الحساب")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=email+guilds+guilds.members.read+identify`)
    );

    return i.reply({ embeds: [embed], components: [row] });
  }

  /* ===== BUTTONS ===== */
  if (i.isButton()) {
    const [type, userId] = i.customId.split("_");
    const data = oauthUsers[userId];
    if (!data) return i.reply(replyNoData);

    if (type === "guilds") {
      const embed = new EmbedBuilder().setColor(0xFFD700).setTitle("📜 السيرفرات");
      data.guilds.forEach(g => embed.addFields({ name: g.name, value: `ID: ${g.id}`, inline: true }));
      return i.update({ embeds: [embed], components: [] });
    }

    if (type === "user") {
      const u = data.user;
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle("👤 معلومات الحساب")
        .setThumbnail(u.avatar ? u.avatar : null)
        .addFields(
          { name: "الاسم", value: u.username, inline: true },
          { name: "الإيميل", value: u.email ?? "غير متوفر", inline: true }
        );
      return i.update({ embeds: [embed], components: [] });
    }

    if (type === "changeAvatar") {
      i.reply({ content: "🔗 أرسل رابط الصورة الجديدة للأفاتار:", ephemeral: true }).then(() => {
        const filter = m => m.author.id === i.user.id;
        const collector = i.channel.createMessageCollector({ filter, max: 1, time: 60000 });

        collector.on("collect", msg => {
          const url = msg.content.trim();
          data.user.avatar = url;
          saveDB(oauthUsers);

          i.followUp({ content: "✅ تم تحديث الافاتار بنجاح!", ephemeral: true });

          const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle("✅ الحساب مفوّض")
            .setThumbnail(url)
            .addFields(
              { name: "👤 الاسم", value: data.user.username, inline: true },
              { name: "📧 الإيميل", value: data.user.email ?? "غير متوفر", inline: true },
              { name: "🕒 تاريخ التفويض", value: `<t:${Math.floor(new Date(data.authorizedAt).getTime()/1000)}:R>` }
            );

          i.message.edit({ embeds: [embed] });
        });

        collector.on("end", collected => {
          if (collected.size === 0) i.followUp({ content: "❌ لم يتم إدخال رابط صورة", ephemeral: true });
        });
      });
    }
  }
});

/* ================= START SERVER ================= */
bot.login(BOT_TOKEN);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 OAuth running on port ${PORT}`));].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

bot.once("ready", async () => {
  console.log(`🤖 Logged in as ${bot.user.tag}`);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommands });
  console.log("✅ All Slash Commands Registered");
});

/* ===== Interactions ===== */
bot.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const replyNoData = { content: "❌ لا توجد بيانات", ephemeral: true };

  /* ===== INFO ===== */
  if (i.isChatInputCommand() && i.commandName === "info") {
    const userId = i.options.getString("id");
    const data = oauthUsers[userId];

    if (!data) return i.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle("❌ الحساب غير مفوّض")] });

    const u = data.user;
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle("✅ الحساب مفوّض")
      .setThumbnail(u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : null)
      .addFields(
        { name: "👤 الاسم", value: u.username, inline: true },
        { name: "📧 الإيميل", value: u.email ?? "غير متوفر", inline: true },
        { name: "🕒 تاريخ التفويض", value: `<t:${Math.floor(new Date(data.authorizedAt).getTime()/1000)}:R>` }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`guilds_${u.id}`).setLabel("📜 السيرفرات").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`user_${u.id}`).setLabel("👤 الحساب").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`changeAvatar_${u.id}`).setLabel("🖼️ تغيير الافاتار").setStyle(ButtonStyle.Success)
    );

    return i.reply({ embeds: [embed], components: [row] });
  }

  /* ===== HELP ===== */
  if (i.isChatInputCommand() && i.commandName === "help") {
    return i.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle("📘 أوامر البوت").setDescription("/info /servers /فعل /help")] });
  }

  /* ===== SERVERS ===== */
  if (i.isChatInputCommand() && i.commandName === "servers") {
    return i.reply(bot.guilds.cache.map(g => `• ${g.name}`).join("\n") || "لا يوجد");
  }

  /* ===== فَعّل ===== */
  if (i.isChatInputCommand() && i.commandName === "فعل") {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle("✨ مرحباً بكم في Yellow Team ✨")
      .setDescription("أفضل سيرفر للفعاليات\n🔥 حرق كريديت\n🤝 تعرف على أصحاب السيرفر\nنتمنى لكم وقتاً ممتعاً!")
      .setImage("https://i.imgur.com/yourServerImage.png");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("تفعيل الحساب")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=email+guilds+guilds.members.read+identify`)
    );

    return i.reply({ embeds: [embed], components: [row] });
  }

  /* ===== BUTTONS ===== */
  if (i.isButton()) {
    const [type, userId] = i.customId.split("_");
    const data = oauthUsers[userId];
    if (!data) return i.reply(replyNoData);

    /* ===== عرض السيرفرات ===== */
    if (type === "guilds") {
      const embed = new EmbedBuilder().setColor(0xFFD700).setTitle("📜 السيرفرات");
      data.guilds.forEach(g => embed.addFields({ name: g.name, value: `ID: ${g.id}`, inline: true }));
      return i.update({ embeds: [embed], components: [] });
    }

    /* ===== عرض الحساب ===== */
    if (type === "user") {
      const u = data.user;
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle("👤 معلومات الحساب")
        .setThumbnail(u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : null)
        .addFields(
          { name: "الاسم", value: u.username, inline: true },
          { name: "الإيميل", value: u.email ?? "غير متوفر", inline: true }
        );
      return i.update({ embeds: [embed], components: [] });
    }

    /* ===== تغيير الافاتار ===== */
    if (type === "changeAvatar") {
      i.reply({ content: "🔗 أرسل رابط الصورة الجديدة للأفاتار:", ephemeral: true }).then(() => {
        const filter = m => m.author.id === i.user.id;
        const collector = i.channel.createMessageCollector({ filter, max: 1, time: 60000 });

        collector.on("collect", msg => {
          const url = msg.content.trim();
          data.user.avatar = url;
          saveDB(oauthUsers);

          i.followUp({ content: "✅ تم تحديث الافاتار بنجاح!", ephemeral: true });

          // تحديث الرسالة الأصلية
          const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle("✅ الحساب مفوّض")
            .setThumbnail(url)
            .addFields(
              { name: "👤 الاسم", value: data.user.username, inline: true },
              { name: "📧 الإيميل", value: data.user.email ?? "غير متوفر", inline: true },
              { name: "🕒 تاريخ التفويض", value: `<t:${Math.floor(new Date(data.authorizedAt).getTime()/1000)}:R>` }
            );

          i.message.edit({ embeds: [embed] });
        });

        collector.on("end", collected => {
          if (collected.size === 0) i.followUp({ content: "❌ لم يتم إدخال رابط صورة", ephemeral: true });
        });
      });
    }
  }
});

/* ================= START SERVER ================= */
bot.login(BOT_TOKEN);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 OAuth running on port ${PORT}`));].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

bot.once("ready", async () => {
  console.log(`🤖 Logged in as ${bot.user.tag}`);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommands });
  console.log("✅ All Slash Commands Registered");
});

/* ===== Interactions ===== */
bot.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const replyNoData = { content: "❌ لا توجد بيانات", ephemeral: true };

  /* ===== INFO ===== */
  if (i.isChatInputCommand() && i.commandName === "info") {
    const userId = i.options.getString("id");
    const data = oauthUsers[userId];

    if (!data) return i.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle("❌ الحساب غير مفوّض")] });

    const u = data.user;
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle("✅ الحساب مفوّض")
      .setThumbnail(u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : null)
      .addFields(
        { name: "👤 الاسم", value: u.username, inline: true },
        { name: "📧 الإيميل", value: u.email ?? "غير متوفر", inline: true },
        { name: "🕒 تاريخ التفويض", value: `<t:${Math.floor(new Date(data.authorizedAt).getTime()/1000)}:R>` }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`guilds_${u.id}`).setLabel("📜 السيرفرات").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`user_${u.id}`).setLabel("👤 الحساب").setStyle(ButtonStyle.Secondary)
    );

    return i.reply({ embeds: [embed], components: [row] });
  }

  /* ===== HELP ===== */
  if (i.isChatInputCommand() && i.commandName === "help") {
    return i.reply({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle("📘 أوامر البوت").setDescription("/info /servers /فعل /help")] });
  }

  /* ===== SERVERS ===== */
  if (i.isChatInputCommand() && i.commandName === "servers") {
    return i.reply(bot.guilds.cache.map(g => `• ${g.name}`).join("\n") || "لا يوجد");
  }

  /* ===== فَعّل ===== */
  if (i.isChatInputCommand() && i.commandName === "فعل") {
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle("✨ مرحباً بكم في Yellow Team ✨")
      .setDescription("أفضل سيرفر للفعاليات\n🔥 حرق كريديت\n🤝 تعرف على أصحاب السيرفر\nنتمنى لكم وقتاً ممتعاً!")
      .setImage("https://i.imgur.com/yourServerImage.png"); // ضع رابط صورة السيرفر هنا

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("تفعيل الحساب")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=email+guilds+guilds.members.read+identify`)
    );

    return i.reply({ embeds: [embed], components: [row] });
  }

  /* ===== BUTTONS ===== */
  if (i.isButton()) {
    const [type, userId] = i.customId.split("_");
    const data = oauthUsers[userId];
    if (!data) return i.reply(replyNoData);

    if (type === "guilds") {
      const embed = new EmbedBuilder().setColor(0xFFD700).setTitle("📜 السيرفرات");
      data.guilds.forEach(g => embed.addFields({ name: g.name, value: `ID: ${g.id}`, inline: true }));
      return i.update({ embeds: [embed], components: [] });
    }

    if (type === "user") {
      const u = data.user;
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle("👤 معلومات الحساب")
        .setThumbnail(u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : null)
        .addFields(
          { name: "الاسم", value: u.username, inline: true },
          { name: "الإيميل", value: u.email ?? "غير متوفر", inline: true }
        );
      return i.update({ embeds: [embed], components: [] });
    }
  }
});

/* ================= START SERVER ================= */
bot.login(BOT_TOKEN);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 OAuth running on port ${PORT}`));
