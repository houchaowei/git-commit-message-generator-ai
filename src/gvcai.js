#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import inquirer from 'inquirer';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import chalk from 'chalk';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { OPENAI_API_KEY, BASE_URL, MODEL } = process.env;

// 获取本地 node/npm 路径
function getBinPath(bin) {
    try {
        return execSync(`which ${bin}`).toString().trim();
    } catch {
        return '';
    }
}
const nodePath = getBinPath('node');
const npmPath = getBinPath('npm');
console.log(chalk.cyan.bold('本地 node 路径:'), chalk.yellow(nodePath));
console.log(chalk.cyan.bold('本地 npm 路径:'), chalk.yellow(npmPath));

// 1. 读取 README.md 和 package.json
const rootDir = process.cwd();
const readmePath = path.join(rootDir, 'README.md');
const pkgPath = path.join(rootDir, 'package.json');

let readme = '';
let pkg = {};
if (fs.existsSync(readmePath)) {
    readme = fs.readFileSync(readmePath, 'utf8');
    console.log(chalk.green.bold('\n读取到的 README.md 内容:'));
    console.log(chalk.gray(readme.slice(0, 1000) + (readme.length > 1000 ? '\n...（已截断）' : '')));
} else {
    console.log(chalk.red('未找到 README.md'));
}
if (fs.existsSync(pkgPath)) {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log(chalk.green.bold('\n读取到的 package.json 内容:'));
    console.log(chalk.gray(JSON.stringify(pkg, null, 2)));
} else {
    console.log(chalk.red('未找到 package.json'));
}

// 2. 组装 prompt
function buildPrompt(readme, pkg, nodePath, npmPath) {
    return `你是一个 VSCode 配置专家，请根据以下项目的 README.md 和 package.json 内容，分析项目类型（如 Web、Node CLI、服务端等）、主要运行方式、入口文件、常用端口、调试需求等，自动生成最合适的 VSCode launch.json 和 tasks.json 配置，要求如下：\n\n1. launch.json 需包含适合本项目的调试配置（如 node attach/launch、chrome attach/launch、端口、webRoot、preLaunchTask 等）。\n2. tasks.json 需包含常用的本地运行/调试脚本（如 npm run dev、npm start、环境变量、端口等）。\n3. 配置内容要尽量自动化、智能化，适配本项目实际情况。\n4. 只返回 launch.json 和 tasks.json 的 JSON 内容，不要有多余解释。\n5. 本地 node 路径为: ${nodePath}，本地 npm 路径为: ${npmPath}，请在所有 command 字段中使用这些绝对路径。\n\n---\nREADME.md 内容：\n${readme}\n---\npackage.json 内容：\n${JSON.stringify(pkg, null, 2)}\n---\n`;
}

const prompt = buildPrompt(readme, pkg, nodePath, npmPath);
console.log(chalk.magenta.bold('\n生成的 AI prompt:'));
console.log(chalk.gray(prompt.length > 2000 ? prompt.slice(0, 2000) + '\n...（已截断）' : prompt));

// 递增生成唯一的 .vscode 目标目录
function getUniqueVscodeDir(baseDir) {
    let dir = path.join(baseDir, '.vscode');
    let i = 1;
    while (fs.existsSync(dir)) {
        dir = path.join(baseDir, `.vscode-ai-${i}`);
        i++;
    }
    return dir;
}

async function callAI(prompt) {
    if (!OPENAI_API_KEY || !BASE_URL) {
        console.error(chalk.red('请设置 OPENAI_API_KEY 和 BASE_URL 环境变量'));
        process.exit(1);
    }
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: MODEL || 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
        })
    });
    const data = await response.json();
    if (!data.choices || !data.choices[0]) {
        console.error(chalk.red('AI 响应格式错误:'), data);
        process.exit(1);
    }
    // 展示 token 消耗
    if (data.usage) {
        console.log(chalk.bgBlue.white.bold('\n本次 AI 请求 token 消耗：'));
        console.log(chalk.blue('  prompt_tokens:'), chalk.yellow(data.usage.prompt_tokens));
        console.log(chalk.blue('  completion_tokens:'), chalk.yellow(data.usage.completion_tokens));
        console.log(chalk.blue('  total_tokens:'), chalk.yellow(data.usage.total_tokens));
    }
    return data.choices[0].message.content;
}

function extractJsonBlocks(text) {
    // 提取所有 json 代码块
    const regex = /```json[\s\S]*?```/g;
    const matches = text.match(regex);
    if (!matches) return [];
    return matches.map(block => {
        return block.replace(/```json|```/g, '').trim();
    });
}

// 递归替换 json 对象中所有 command 字段的 node/npm 路径
function replaceCommandPaths(obj, nodePath, npmPath) {
    if (Array.isArray(obj)) {
        return obj.map(item => replaceCommandPaths(item, nodePath, npmPath));
    } else if (typeof obj === 'object' && obj !== null) {
        const newObj = {};
        for (const key in obj) {
            if (key === 'command' && typeof obj[key] === 'string') {
                let cmd = obj[key];
                // 替换 npm/node 路径
                cmd = cmd.replace(/\b(node|npm)[^\s]*/g, m => {
                    if (m.includes('node')) return nodePath;
                    if (m.includes('npm')) return npmPath;
                    return m;
                });
                newObj[key] = cmd;
            } else {
                newObj[key] = replaceCommandPaths(obj[key], nodePath, npmPath);
            }
        }
        return newObj;
    } else {
        return obj;
    }
}

(async () => {
    console.log(chalk.cyan.bold('\n正在调用 AI 生成 VSCode 调试配置...'));
    const aiResult = await callAI(prompt);
    // 尝试提取 json 代码块
    const jsonBlocks = extractJsonBlocks(aiResult);
    if (jsonBlocks.length < 2) {
        console.error(chalk.red('AI 返回内容无法识别 launch.json 和 tasks.json，请手动检查：\n'), aiResult);
        process.exit(1);
    }
    let launchJson, tasksJson;
    try {
        launchJson = JSON.parse(jsonBlocks[0]);
        tasksJson = JSON.parse(jsonBlocks[1]);
    } catch (e) {
        console.error(chalk.red('AI 返回的 JSON 解析失败，请手动检查：\n'), aiResult);
        process.exit(1);
    }
    // 替换 command 路径
    launchJson = replaceCommandPaths(launchJson, nodePath, npmPath);
    tasksJson = replaceCommandPaths(tasksJson, nodePath, npmPath);
    // 生成唯一 .vscode-ai-x 目录
    const targetDir = getUniqueVscodeDir(rootDir);
    fs.mkdirSync(targetDir);
    const launchPath = path.join(targetDir, 'launch.json');
    const tasksPath = path.join(targetDir, 'tasks.json');
    fs.writeFileSync(launchPath, JSON.stringify(launchJson, null, 2), 'utf8');
    fs.writeFileSync(tasksPath, JSON.stringify(tasksJson, null, 2), 'utf8');
    console.log(chalk.green.bold(`\nAI 生成的 VSCode 配置已写入: ${targetDir}`));
    console.log(chalk.cyan('launch.json 路径:'), chalk.yellow(launchPath));
    console.log(chalk.cyan('tasks.json 路径:'), chalk.yellow(tasksPath));
})(); 