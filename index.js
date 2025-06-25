#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const { OPENAI_API_KEY, WORKSPACE_DIR } = process.env;

// 获取命令行参数
const [, , flowId, projectName] = process.argv;
if (!flowId || !projectName) {
    console.log('请传入参数: node index.js <flow-xxxx> <projectName>');
    process.exit(1);
}

const workspaceDir = WORKSPACE_DIR;
const projectPath = path.join(workspaceDir, projectName);

if (!fs.existsSync(projectPath)) {
    console.log(`项目 ${projectName} 不存在于 ${workspaceDir}`);
    process.exit(1);
}

try {
    // 获取 git diff 变更
    const gitDiff = execSync('git diff', { cwd: projectPath, encoding: 'utf-8' });
    if (gitDiff.trim() === '') {
        console.log('当前分支没有未提交的变更。');
    } else {
        // console.log('当前分支的变更如下：\n');
        // console.log(gitDiff);
        const message = `
            根据以下 git diff 变更，生成一个 git commit 信息，需要包含：\n
            1. 变更修改的内容\n
            2. 变更修改的原因\n
            按照以下示例格式返回：
            fix(Flow-23456): 修复购物车数量更新时的状态同步问题

                - 解决了购物车组件在数量变更时状态不同步的问题
                - 优化了购物车数据更新的时序处理逻辑\n
                - 修复了并发更新导致的数据不一致问题\n
                - 确保购物车状态在各个组件间的正确同步\n
            ${gitDiff}
        `;

        // TODO：接入 mcp 服务，针对 git diff 的变更，进行代码分析，并给出分析结果
        const response = await fetch('https://api.chatanywhere.tech/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini', // 免费版支持deepseek, gpt-3.5-turbo, embedding, gpt-4o-mini, gpt-4o。
                messages: [{ role: 'user', content: message }],
                temperature: 0.7
            })
        });
        
        const data = await response.json();
        // console.log(JSON.stringify(data, null, 2));
        const commitMessage = data.choices[0].message.content;
        console.log(commitMessage);

        // 复制到剪贴板
        execSync('echo "' + commitMessage + '" | pbcopy');

        // 1 curl https://api.chatanywhere.tech/v1/chat/completions \
        // 2   -H 'Content-Type: application/json' \
        // 3   -H 'Authorization: Bearer YOUR_API_KEY' \
        // 4   -d '{
        // 5   "model": "gpt-3.5-turbo",
        // 6   "messages": [{"role": "user", "content": "Say this is a test!"}],
        // 7   "temperature": 0.7
        // 8 }'
    }
} catch (err) {
    console.log('获取 git diff 失败，请确认该目录为 git 仓库。');
    process.exit(1);
}

