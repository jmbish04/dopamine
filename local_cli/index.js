import { Command } from 'commander';
import fetch from 'node-fetch';
import chalk from 'chalk';

const program = new Command();
const API_BASE = 'http://127.0.0.1:8787/api';

program
  .name('dopamine')
  .description('CLI to manage tasks and timers for The Onion Tasker')
  .version('1.0.0');

program.command('tasks')
  .description('List all tasks')
  .action(async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error: ${res.status} ${res.statusText} - ${errorText}`);
      }
      const tasks = await res.json();
      console.log(chalk.bold.blue('\nYour Tasks:'));
      tasks.forEach(t => {
        const statusColor = t.status === 'completed' ? chalk.green : chalk.yellow;
        console.log(`${chalk.gray(t.id)} | ${t.title} | ${statusColor(t.status)}`);
      });
      console.log();
    } catch (e) {
      console.error(chalk.red('Error fetching tasks. Is the local worker running?'), e);
    }
  });

program.command('add <title>')
  .description('Add a new task')
  .action(async (title) => {
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error: ${res.status} ${res.statusText} - ${errorText}`);
      }
      const task = await res.json();
      console.log(chalk.green(`✔ Task added: ${task.title} (ID: ${task.id})`));
    } catch (e) {
      console.error(chalk.red('Error adding task.'), e);
    }
  });

program.command('complete <id>')
  .description('Mark a task as completed')
  .action(async (id) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error: ${res.status} ${res.statusText} - ${errorText}`);
      }
      const task = await res.json();
      console.log(chalk.green(`✔ Task ${id} marked as completed!`));
    } catch (e) {
      console.error(chalk.red('Error completing task.'), e);
    }
  });

program.command('spotify-research')
  .description('Trigger Spotify lofi music discovery workflow')
  .option('-a, --agent <name>', 'Poster agent name', 'poster')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🎵 Starting Spotify lofi music discovery workflow...'));
      const res = await fetch(`${API_BASE}/spotify/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterAgentName: options.agent })
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error: ${res.status} ${res.statusText} - ${errorText}`);
      }
      const result = await res.json();
      console.log(chalk.green(`✔ ${result.message}`));
      console.log(chalk.gray(`Workflow ID: ${result.workflowId}`));
      console.log(chalk.yellow('\n💡 The workflow is now running in the background. It will:'));
      console.log(chalk.gray('  1. Search for lofi hip hop playlists on Spotify'));
      console.log(chalk.gray('  2. Discover artists from these playlists'));
      console.log(chalk.gray('  3. Fetch detailed artist information'));
      console.log(chalk.gray('  4. Enhance descriptions with AI'));
      console.log(chalk.gray('  5. Optionally capture screenshots'));
      console.log(chalk.gray('  6. Format results using the poster agent\n'));
    } catch (e) {
      console.error(chalk.red('Error starting Spotify research workflow.'), e);
    }
  });

program.parse();
