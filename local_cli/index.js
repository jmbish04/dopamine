import { Command } from 'commander';
import fetch from 'node-fetch';
import chalk from 'chalk';

const program = new Command();
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:8787/api';

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

program.parse();
