const express = require("express");
const axios = require("axios");

const app = express();

// ====== ضع بياناتك ======
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = "https://discord-oauth-a8h1.onrender.com/callback";
// ========================

app.get("/", (req, res) => {
  res.send("Discord OAuth Server Running ✅");
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("❌ لم يتم استلام كود التفويض");

  try {
    // 1️⃣ تبديل الكود بـ Access Token
    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenResponse.data.access_token;

    // 2️⃣ جلب بيانات المستخدم
    const userResponse = await axios.get(
      "https://discord.com/api/users/@me",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const user = userResponse.data;

    // 3️⃣ صفحة نجاح التفويض
    res.send(`
      <html>
      <head>
        <title>نجح التفويض</title>
        <style>
          body { font-family: Arial; background:#0f172a; color:#fff; text-align:center; padding-top:60px }
          .card { background:#1e293b; display:inline-block; padding:30px; border-radius:15px }
          img { border-radius:50%; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✅ نجح التفويض</h1>
          <img src="https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png" width="100"><br><br>
          <b>اسم الحساب:</b> ${user.username}<br>
          <b>ID:</b> ${user.id}<br><br>
          <b>الصلاحيات:</b><br>
          identify, email, connections, guilds
        </div>
      </body>
      </html>
    `);

  } catch (err) {
    console.error(err.response?.data || err);
    res.send("❌ فشل التفويض");
  }
});

app.listen(3000, () => {
  console.log("OAuth server running on port 3000");
});
