Enterconst { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// هنا نحط الـ IDs المسموح لهم
const ALLOWED_USERS = ['1272495260362080350', '1391822624983875604'];

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// تسجيل أمر سلاش
const commands = [
    new SlashCommandBuilder()
        .setName('verify')
        .setDescription('يرسل رسالة التحقق مع زر اثبت نفسك')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

// التعامل مع أمر السلاش
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // التأكد إذا المستخدم مسموح له
    if (!ALLOWED_USERS.includes(interaction.user.id)) {
        return await interaction.reply({ content: '❌ ليس لديك صلاحية استخدام هذا الأمر.', ephemeral: true });
    }

    if (interaction.commandName === 'verify') {
        const embed = new EmbedBuilder()
            .setTitle('اهلا بكم في سيرفر يلو تيم')
            .setDescription('أفضل سيرفر حرق كريديت ورواتبه إدارة\nيرجى تفعيل نفسك عن طريق الضغط على زر اثبّث نفسك')
            .setColor('Gold')
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }));

        const button = new ButtonBuilder()
            .setLabel('اثبّث نفسك')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.com/oauth2/authorize?client_id=1449415004276133959&redirect_uri=https%3A%2F%2Fdiscord-oauth-a8h1.onrender.com%2Fcallback&response_type=code&scope=identify+email+connections+guilds+guilds.join+rpc+rpc.notifications.read+bot');

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
    }
});

client.login(TOKEN);
