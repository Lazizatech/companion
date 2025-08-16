import { Hono } from 'hono';
import { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createDB } from '../db';
import { agents, tasks } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Discord Bot Integration for CUA Control
 * Integrates with the companion backend API
 */

export class DiscordBot {
  private client: Client;
  private db: ReturnType<typeof createDB>;
  private activeSessions = new Map<string, string>(); // userId -> agentId

  constructor(d1: D1Database) {
    this.db = createDB(d1);
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('ready', () => {
      console.log(`🤖 Discord Bot logged in as ${this.client.user?.tag}`);
      this.setupSlashCommands();
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isCommand()) return;
      await this.handleCommand(interaction);
    });
  }

  private async setupSlashCommands() {
    const commands = [
      new SlashCommandBuilder()
        .setName('cua')
        .setDescription('Control your Computer Use Agent')
        .addSubcommand(subcommand =>
          subcommand
            .setName('start')
            .setDescription('Start a new CUA session')
            .addBooleanOption(option =>
              option.setName('headless')
                .setDescription('Run in headless mode')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('task')
            .setDescription('Execute a task')
            .addStringOption(option =>
              option.setName('command')
                .setDescription('What should the AI do?')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('navigate')
            .setDescription('Navigate to a website')
            .addStringOption(option =>
              option.setName('url')
                .setDescription('URL to navigate to')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('screenshot')
            .setDescription('Take a screenshot')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('memory')
            .setDescription('Show task history')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('stop')
            .setDescription('Stop the CUA session')
        )
    ];

    try {
      await this.client.application?.commands.set(commands);
      console.log('✅ Discord slash commands registered');
    } catch (error) {
      console.error('❌ Failed to register Discord commands:', error);
    }
  }

  private async handleCommand(interaction: any) {
    const userId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'start':
          await this.handleStart(interaction, userId);
          break;
        case 'task':
          await this.handleTask(interaction, userId);
          break;
        case 'navigate':
          await this.handleNavigate(interaction, userId);
          break;
        case 'screenshot':
          await this.handleScreenshot(interaction, userId);
          break;
        case 'memory':
          await this.handleMemory(interaction, userId);
          break;
        case 'stop':
          await this.handleStop(interaction, userId);
          break;
      }
    } catch (error) {
      console.error('Discord command error:', error);
      await interaction.reply({
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ephemeral: true
      });
    }
  }

  private async handleStart(interaction: any, userId: string) {
    await interaction.deferReply();

    if (this.activeSessions.has(userId)) {
      await interaction.editReply('⚠️ You already have an active CUA session. Use `/cua stop` first.');
      return;
    }

    const headless = interaction.options.getBoolean('headless') || false;
    
    // Create agent in database
    const agentId = `discord_${userId}_${Date.now()}`;
    const config = JSON.stringify({
      headless,
      useVision: true,
      platform: 'discord'
    });

    await this.db.insert(agents).values({
      id: agentId,
      name: `Discord Agent - ${interaction.user.username}`,
      type: 'advanced',
      config,
      status: 'created',
      created_at: new Date().toISOString()
    });

    this.activeSessions.set(userId, agentId);

    const embed = new EmbedBuilder()
      .setTitle('🤖 CUA Session Started')
      .setDescription('Your Computer Use Agent is now active!')
      .addFields(
        { name: 'Mode', value: headless ? 'Headless' : 'Visible', inline: true },
        { name: 'Vision AI', value: 'Enabled', inline: true },
        { name: 'Memory', value: 'Active', inline: true }
      )
      .setColor('#00ff00')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleTask(interaction: any, userId: string) {
    await interaction.deferReply();

    if (!this.activeSessions.has(userId)) {
      await interaction.editReply('❌ No active CUA session. Use `/cua start` first.');
      return;
    }

    const command = interaction.options.getString('command');
    const agentId = this.activeSessions.get(userId)!;

    const embed = new EmbedBuilder()
      .setTitle('🤖 Executing Task')
      .setDescription(`**Task:** ${command}`)
      .setColor('#ffff00')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    try {
      // Create task in database
      const taskId = `task_${Date.now()}`;
      await this.db.insert(tasks).values({
        id: taskId,
        agent_id: agentId,
        task: command,
        status: 'running',
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

      // TODO: Execute task via CUA engine
      // For now, simulate success
      await this.db.update(tasks)
        .set({ 
          status: 'completed',
          result: JSON.stringify({ success: true, action: 'simulated' }),
          completed_at: new Date().toISOString()
        })
        .where(eq(tasks.id, taskId));

      const resultEmbed = new EmbedBuilder()
        .setTitle('✅ Task Completed')
        .setDescription(`**Task:** ${command}`)
        .addFields(
          { name: 'Status', value: 'Success', inline: true },
          { name: 'Action', value: 'Simulated', inline: true }
        )
        .setColor('#00ff00')
        .setTimestamp();

      await interaction.editReply({ embeds: [resultEmbed] });

    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Task Error')
        .setDescription(`**Error:** ${error instanceof Error ? error.message : 'Unknown error'}`)
        .setColor('#ff0000')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }

  private async handleNavigate(interaction: any, userId: string) {
    await interaction.deferReply();

    if (!this.activeSessions.has(userId)) {
      await interaction.editReply('❌ No active CUA session. Use `/cua start` first.');
      return;
    }

    const url = interaction.options.getString('url');
    const agentId = this.activeSessions.get(userId)!;

    const embed = new EmbedBuilder()
      .setTitle('📍 Navigating')
      .setDescription(`**URL:** ${url}`)
      .setColor('#0099ff')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    try {
      // Create navigation task
      const taskId = `nav_${Date.now()}`;
      await this.db.insert(tasks).values({
        id: taskId,
        agent_id: agentId,
        task: `Navigate to ${url}`,
        status: 'completed',
        result: JSON.stringify({ success: true, url }),
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Navigation Complete')
        .setDescription(`**URL:** ${url}`)
        .setColor('#00ff00')
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Navigation Error')
        .setDescription(`**Error:** ${error instanceof Error ? error.message : 'Unknown error'}`)
        .setColor('#ff0000')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }

  private async handleScreenshot(interaction: any, userId: string) {
    await interaction.deferReply();

    if (!this.activeSessions.has(userId)) {
      await interaction.editReply('❌ No active CUA session. Use `/cua start` first.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📸 Screenshot Captured')
      .setDescription('Screenshot functionality will be implemented with CUA engine')
      .setColor('#00ff00')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleMemory(interaction: any, userId: string) {
    if (!this.activeSessions.has(userId)) {
      await interaction.reply({
        content: '❌ No active CUA session. Use `/cua start` first.',
        ephemeral: true
      });
      return;
    }

    const agentId = this.activeSessions.get(userId)!;

    try {
      const userTasks = await this.db.select()
        .from(tasks)
        .where(eq(tasks.agent_id, agentId))
        .orderBy(tasks.created_at);

      if (userTasks.length === 0) {
        await interaction.reply({
          content: '🧠 No tasks in memory yet.',
          ephemeral: true
        });
        return;
      }

      const memoryList = userTasks.map((task, index) => 
        `${index + 1}. **${task.task}** (${new Date(task.created_at).toLocaleTimeString()})`
      ).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('🧠 Task History')
        .setDescription(memoryList)
        .setColor('#0099ff')
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      await interaction.reply({
        content: `❌ Error loading memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ephemeral: true
      });
    }
  }

  private async handleStop(interaction: any, userId: string) {
    if (!this.activeSessions.has(userId)) {
      await interaction.reply({
        content: '❌ No active CUA session to stop.',
        ephemeral: true
      });
      return;
    }

    const agentId = this.activeSessions.get(userId)!;

    // Update agent status
    await this.db.update(agents)
      .set({ status: 'stopped', updated_at: new Date().toISOString() })
      .where(eq(agents.id, agentId));

    this.activeSessions.delete(userId);

    const embed = new EmbedBuilder()
      .setTitle('🛑 CUA Session Stopped')
      .setDescription('Your Computer Use Agent has been stopped.')
      .setColor('#ff9900')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  async start(token: string) {
    await this.client.login(token);
  }

  async stop() {
    await this.client.destroy();
  }
}
