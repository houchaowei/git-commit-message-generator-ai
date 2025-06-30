#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import os from 'os';

dotenv.config();

const { OPENAI_API_KEY, BASE_URL, MODEL } = process.env;

class GitCommitMCP {
  constructor() {
    this.server = new Server(
      {
        name: 'git-commit-generator',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'generate_commit_message',
          description: '根据 git diff 或新增文件生成规范的 commit message',
          inputSchema: {
            type: 'object',
            properties: {
              flowId: {
                type: 'string',
                description: 'Flow ID (如 Flow-22914)',
                pattern: '^[Ff]low-\\d+$'
              },
              workingDirectory: {
                type: 'string',
                description: 'Git 仓库的工作目录路径（可选，默认为当前目录）'
              }
            },
            required: ['flowId']
          }
        },
        {
          name: 'analyze_git_changes',
          description: '分析当前 git 仓库的变更情况',
          inputSchema: {
            type: 'object',
            properties: {
              workingDirectory: {
                type: 'string',
                description: 'Git 仓库的工作目录路径（可选，默认为当前目录）'
              }
            }
          }
        },
        {
          name: 'execute_git_commit',
          description: '执行 git commit 操作',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Commit message 内容'
              },
              workingDirectory: {
                type: 'string',
                description: 'Git 仓库的工作目录路径（可选，默认为当前目录）'
              },
              addAll: {
                type: 'boolean',
                description: '是否执行 git add . （默认为 true）',
                default: true
              }
            },
            required: ['message']
          }
        },
        {
          name: 'execute_git_push',
          description: '执行 git push 操作',
          inputSchema: {
            type: 'object',
            properties: {
              workingDirectory: {
                type: 'string',
                description: 'Git 仓库的工作目录路径（可选，默认为当前目录）'
              }
            }
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'generate_commit_message':
            return await this.handleGenerateCommitMessage(args);
          case 'analyze_git_changes':
            return await this.handleAnalyzeGitChanges(args);
          case 'execute_git_commit':
            return await this.handleExecuteGitCommit(args);
          case 'execute_git_push':
            return await this.handleExecuteGitPush(args);
          default:
            throw new Error(`未知的工具: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  execCommand(command, workingDirectory = process.cwd()) {
    try {
      return execSync(command, {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        stdio: 'pipe',
        cwd: workingDirectory
      });
    } catch (error) {
      if (error.stderr) {
        throw new Error(`命令执行错误: ${error.stderr.toString()}`);
      }
      throw error;
    }
  }

  checkGitRepository(workingDirectory = process.cwd()) {
    if (!fs.existsSync(path.join(workingDirectory, '.git'))) {
      throw new Error('当前目录不是 git 仓库，请在 git 项目目录下运行。');
    }
  }

  async callOpenAI(prompt, content) {
    if (!OPENAI_API_KEY) {
      throw new Error('请设置 OPENAI_API_KEY 环境变量');
    }

    const message = prompt + '\n' + content;
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: message }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (!data.choices || !data.choices[0]) {
      throw new Error(`API 响应格式错误: ${JSON.stringify(data)}`);
    }

    return data.choices[0].message.content;
  }

  async handleAnalyzeGitChanges(args) {
    const workingDirectory = args.workingDirectory || process.cwd();
    this.checkGitRepository(workingDirectory);

    try {
      const gitDiff = this.execCommand('git diff', workingDirectory);
      const gitStatus = this.execCommand('git status', workingDirectory);

      // 解析新增文件
      const statusLines = gitStatus.split('\n');
      let inUntracked = false;
      const newFiles = [];
      
      for (let line of statusLines) {
        line = line.trimEnd();
        if (line.trim().startsWith('new file:')) {
          newFiles.push(line.replace('new file:', '').trim());
        } else if (line.trim().startsWith('Untracked files:')) {
          inUntracked = true;
        } else if (inUntracked) {
          if (line.startsWith('\t') && line.trim() && !line.includes('use "git add')) {
            newFiles.push(line.trim());
          } else if (!line.trim()) {
            inUntracked = false;
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              hasDiff: gitDiff.trim() !== '',
              hasNewFiles: newFiles.length > 0,
              gitDiff: gitDiff.trim(),
              newFiles,
              gitStatus: gitStatus.trim()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`分析 git 变更失败: ${error.message}`);
    }
  }

  async handleGenerateCommitMessage(args) {
    const { flowId, workingDirectory = process.cwd() } = args;
    this.checkGitRepository(workingDirectory);

    // 验证 flowId 格式
    if (!flowId.match(/^[Ff]low-\d+$/)) {
      throw new Error('flowId 格式不正确，应为 Flow-XXXXX 格式');
    }

    const analysis = await this.handleAnalyzeGitChanges({ workingDirectory });
    const analysisData = JSON.parse(analysis.content[0].text);

    let commitMessage;

    if (analysisData.hasDiff) {
      // 有 diff，走变更分析
      const prompt = `根据以下 git diff 变更，生成一个 git commit 信息，只需要返回文字和换行符，不需要返回其他的字符，需要包含：
1. 变更修改的内容
2. 变更修改的原因

按照以下格式返回（使用实际的 flowId: ${flowId}）：
fix(${flowId}): 修复xxx问题

- 详细变更点1
- 详细变更点2
- 详细变更点3
- 变更影响和意义总结`;

      commitMessage = await this.callOpenAI(prompt, analysisData.gitDiff);
    } else if (analysisData.hasNewFiles) {
      // 有新增文件，走新增分析
      let filesContent = '';
      for (const file of analysisData.newFiles) {
        try {
          const content = fs.readFileSync(path.join(workingDirectory, file), 'utf8');
          const lines = content.split('\n');
          let displayContent = content;
          if (lines.length > 400) {
            displayContent = lines.slice(0, 200).join('\n') + '\n...\n' + lines.slice(-200).join('\n');
          }
          filesContent += `文件: ${file}\n内容:\n${displayContent}\n\n`;
        } catch (e) {
          filesContent += `文件: ${file}\n读取失败: ${e.message}\n\n`;
        }
      }

      const prompt = `根据以下新增文件的代码内容，生成一个 git commit 信息，只需要返回文字和换行符，不需要返回其他的字符，需要包含：
1. 新增了哪些文件及其主要功能
2. 新增的业务或技术价值

按照以下格式返回（使用实际的 flowId: ${flowId}）：
feat(${flowId}): 新增xxx功能

- 新增了xxx文件，实现了xxx功能
- 主要逻辑说明
- 业务或技术价值总结`;

      commitMessage = await this.callOpenAI(prompt, filesContent);
    } else {
      throw new Error('当前分支没有新增文件，也没有未提交的变更。');
    }

    return {
      content: [
        {
          type: 'text',
          text: commitMessage.trim()
        }
      ]
    };
  }

  async handleExecuteGitCommit(args) {
    const { message, workingDirectory = process.cwd(), addAll = true } = args;
    this.checkGitRepository(workingDirectory);

    try {
      if (addAll) {
        this.execCommand('git add .', workingDirectory);
      }
      
      // 转义 commit message 中的双引号
      const escapedMessage = message.replace(/"/g, '\\"');
      this.execCommand(`git commit -m "${escapedMessage}"`, workingDirectory);

      return {
        content: [
          {
            type: 'text',
            text: '✅ git commit 执行成功！'
          }
        ]
      };
    } catch (error) {
      throw new Error(`git commit 执行失败: ${error.message}`);
    }
  }

  async handleExecuteGitPush(args) {
    const { workingDirectory = process.cwd() } = args;
    this.checkGitRepository(workingDirectory);

    try {
      this.execCommand('git push', workingDirectory);
      
      return {
        content: [
          {
            type: 'text',
            text: '✅ git push 执行成功！'
          }
        ]
      };
    } catch (error) {
      throw new Error(`git push 执行失败: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Git Commit Message Generator MCP Server 已启动');
  }
}

const server = new GitCommitMCP();
server.run().catch(console.error); 