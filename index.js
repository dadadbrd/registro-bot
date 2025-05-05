const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionsBitField,
} = require('discord.js');
const config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, () => {
  console.log(`🤖 Bot online como ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.content === '!Registerpad') {
    const embed = new EmbedBuilder()
      .setTitle('📋 Registro de Novos Membros')
      .setDescription('Clique no botão abaixo para se registrar.')
      .setColor('Blue');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('abrir_formulario')
        .setLabel('📝 Registrar-se')
        .setStyle(ButtonStyle.Primary)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  // Abrir formulário
  if (interaction.isButton() && interaction.customId === 'abrir_formulario') {
    const modal = new ModalBuilder()
      .setCustomId('formulario_registro')
      .setTitle('📋 Formulário de Registro');

    const nome = new TextInputBuilder()
      .setCustomId('nome')
      .setLabel('Seu nome')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const numero = new TextInputBuilder()
      .setCustomId('numero')
      .setLabel('Número de telefone no jogo')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const idjogo = new TextInputBuilder()
      .setCustomId('idjogo')
      .setLabel('ID do jogo')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const recrutador = new TextInputBuilder()
      .setCustomId('recrutador')
      .setLabel('Quem te recrutou?')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nome),
      new ActionRowBuilder().addComponents(numero),
      new ActionRowBuilder().addComponents(idjogo),
      new ActionRowBuilder().addComponents(recrutador)
    );

    await interaction.showModal(modal);
  }

  // Receber formulário
  if (interaction.isModalSubmit() && interaction.customId === 'formulario_registro') {
    const nome = interaction.fields.getTextInputValue('nome');
    const numero = interaction.fields.getTextInputValue('numero');
    const idjogo = interaction.fields.getTextInputValue('idjogo');
    const recrutador = interaction.fields.getTextInputValue('recrutador');
    const userId = interaction.user.id;

    const embed = new EmbedBuilder()
      .setTitle('📥 Novo Registro Recebido')
      .setColor('Green')
      .addFields(
        { name: 'Nome', value: nome },
        { name: 'Número no jogo', value: numero },
        { name: 'ID do jogo', value: idjogo },
        { name: 'Recrutador', value: recrutador },
        { name: 'Usuário', value: `<@${userId}> (ID: ${userId})` }
      )
      .setFooter({ text: `Enviado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

    const aceitarBtn = new ButtonBuilder()
      .setCustomId(`aceitar_${userId}_${nome}_${idjogo}`)
      .setLabel('✅ Aceitar Registro')
      .setStyle(ButtonStyle.Success);

    const recusarBtn = new ButtonBuilder()
      .setCustomId(`recusar_${userId}`)
      .setLabel('❌ Recusar Registro')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(aceitarBtn, recusarBtn);

    const canal = await client.channels.fetch(config.canalDestinoId);
    await canal.send({ embeds: [embed], components: [row] });

    await interaction.reply({ content: '✅ Formulário enviado com sucesso!', flags: 64 });
  }

  // Aceitar ou Recusar
  if (interaction.isButton() && (interaction.customId.startsWith('aceitar_') || interaction.customId.startsWith('recusar_'))) {
    const [acao, userId, nome, idjogo] = interaction.customId.split('_');
    const guild = interaction.guild;
    const membro = await guild.members.fetch(userId).catch(() => null);

    if (!membro) {
      return interaction.reply({ content: '❌ Membro não encontrado.', flags: 64 });
    }

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return interaction.reply({ content: '🚫 Você não tem permissão para isso.', flags: 64 });
    }

    if (acao === 'aceitar') {
      const cargo = guild.roles.cache.get(config.cargoRegistroId);
      if (!cargo) return interaction.reply({ content: '❌ Cargo não encontrado.', flags: 64 });

      await membro.roles.add(cargo).catch(console.error);

      // Mudar apelido para "nome idjogo"
      try {
        await membro.setNickname(`${nome} ${idjogo}`);
      } catch (err) {
        console.warn(`❗ Não foi possível mudar o apelido de ${membro.user.tag}:`, err.message);
      }

      const forumChannel = await client.channels.fetch(config.canalForumId).catch(() => null);
      if (forumChannel && forumChannel.type === ChannelType.GuildForum) {
        await forumChannel.threads.create({
          name: `${nome} - META`,
          message: {
            content: `📌 Registro aprovado!\n👤 **Nome:** ${nome}\n🆔 **ID do jogo:** ${idjogo}\n📱 **Discord:** <@${userId}>\n\n📅 **METAS SEMANAIS:**\n(Insira aqui as metas semanais ou estrutura padrão de metas).`,
          },
          reason: 'Registro aprovado e fórum criado.',
        });
      }

      await interaction.update({
        content: `✅ Registro de <@${userId}> aceito! Cargo atribuído e apelido alterado.`,
        components: [],
        embeds: []
      });
    }

    if (acao === 'recusar') {
      await membro.kick('Registro recusado').catch(console.error);
      await interaction.update({
        content: `❌ Registro de <@${userId}> recusado e membro expulso.`,
        components: [],
        embeds: []
      });
    }
  }
});

client.login(config.token);
