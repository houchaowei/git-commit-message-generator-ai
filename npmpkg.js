#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const { OPENAI_API_KEY } = process.env;

// 获取命令行参数
const [, , flowId] = process.argv;
if (!flowId) {
    console.log('请传入参数: node npmpkg.js <flow-xxxx>');
    process.exit(1);
}

// 检查是否为 git 仓库
const currentDir = process.cwd();
if (!fs.existsSync(path.join(currentDir, '.git'))) {
    console.log('当前目录不是 git 仓库，请在 git 项目目录下运行。');
    process.exit(1);
}

// 主函数
async function main() {
    try {
        // 获取 git diff 变更
        const gitDiff = execSync('git diff', { encoding: 'utf-8' });

        if (gitDiff.trim() === '') {
            console.log('当前分支没有未提交的变更。');
            process.exit(0);
        }

        // 构建提示信息
        const message = `
根据以下 git diff 变更，生成一个 git commit 信息，只需要返回文字和换行符，不需要返回其他的字符，需要包含：
1. 变更修改的内容
2. 变更修改的原因

按照以下格式返回（使用实际的 flowId: ${flowId}）：
fix(${flowId}): 修复购物车数量更新时的状态同步问题

    - 解决了购物车组件在数量变更时状态不同步的问题
    - 优化了购物车数据更新的时序处理逻辑
    - 修复了并发更新导致的数据不一致问题
    - 确保购物车状态在各个组件间的正确同步

${gitDiff}`;

        if (!OPENAI_API_KEY) {
            console.log('请设置 OPENAI_API_KEY 环境变量');
            process.exit(1);
        }

        // 调用 API 生成 commit message
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

        if (!data.choices || !data.choices[0]) {
            console.log('API 响应格式错误:', data);
            process.exit(1);
        }

        const commitMessage = data.choices[0].message.content;
        console.log('\n生成的 commit message:\n');
        console.log(commitMessage);

        // 复制到剪贴板
        try {
            // 使用临时文件来处理特殊字符
            const tempFile = path.join(process.cwd(), '.temp_commit_msg');
            fs.writeFileSync(tempFile, commitMessage, 'utf8');
            execSync(`cat "${tempFile}" | pbcopy`);
            fs.unlinkSync(tempFile); // 删除临时文件
            console.log('\n✅ 已复制到剪贴板！');
        } catch (copyError) {
            console.log('\n❌ 复制到剪贴板失败:', copyError.message);
        }

    } catch (err) {
        if (err.message.includes('git')) {
            console.log('获取 git diff 失败，请确认该目录为 git 仓库。');
        } else if (err.message.includes('fetch')) {
            console.log('API 调用失败:', err.message);
        } else {
            console.log('发生错误:', err.message);
        }
        process.exit(1);
    }
}

// 运行主函数
main().catch(err => {
    console.error('程序执行失败:', err);
    process.exit(1);
});

