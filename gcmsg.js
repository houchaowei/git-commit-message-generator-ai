#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import os from 'os';
import inquirer from 'inquirer';

dotenv.config();

const { OPENAI_API_KEY, BASE_URL } = process.env;

// 获取命令行参数
const [, , flowId] = process.argv;
if (!flowId) {
    console.log('请传入参数: npx gcmsg <flow-xxxx>');
    process.exit(1);
}

// 检查是否为 git 仓库
const currentDir = process.cwd();
if (!fs.existsSync(path.join(currentDir, '.git'))) {
    console.log('当前目录不是 git 仓库，请在 git 项目目录下运行。');
    process.exit(1);
}

// 执行命令的包装函数
function execCommand(command, options = {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    stdio: 'pipe'
}) {
    try {
        const defaultOptions = {
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            stdio: 'pipe'
        };
        return execSync(command, { ...defaultOptions, ...options });
    } catch (error) {
        if (error.stderr) {
            console.error(`命令执行错误: ${error.stderr.toString()}`);
        }
        throw error;
    }
}

// 主函数
async function main() {
    try {
        // 获取 git diff 变更
        const gitDiff = execCommand('git diff');

        if (gitDiff.trim() === '') {
            // 执行 git status 获取当前分支的文件列表
            const gitStatus = execCommand('git status');
            const fileList = gitStatus.split('\n').filter(line => line.trim().startsWith('new file:'));
            if (fileList.length > 0) {
                console.log('当前分支有新增文件，需要分析新增文件的代码，生成 commit message');
                // 1. 提取新增文件名
                const newFiles = fileList.map(line => line.replace('new file:', '').trim());
                // 2. 读取每个文件内容
                let filesContent = '';
                for (const file of newFiles) {
                    try {
                        const content = fs.readFileSync(path.join(currentDir, file), 'utf8');
                        // 若内容过长，截断前后各 200 行
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
                // 3. 构造 AI 提示词
                const message = `
根据以下新增文件的代码内容，生成一个 git commit 信息，只需要返回文字和换行符，不需要返回其他的字符，需要包含：\n1. 新增了哪些文件及其主要功能\n2. 新增的业务或技术价值\n\n按照以下格式返回（使用实际的 flowId: ${flowId}）：\nfeat(${flowId}): 新增xxx功能\n\n    - 新增了xxx文件，实现了xxx功能\n    - 主要逻辑说明\n    - 业务或技术价值总结\n\n${filesContent}`;
                if (!OPENAI_API_KEY) {
                    console.log('请设置 OPENAI_API_KEY 环境变量');
                    process.exit(1);
                }
                // 4. 调用 AI 接口生成 commit message
                const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
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
                // 5. 复制到剪贴板
                try {
                    const tempFile = path.join(os.tmpdir(), `.temp_commit_msg_${Date.now()}`);
                    fs.writeFileSync(tempFile, commitMessage, 'utf8');
                    execCommand(`cat "${tempFile}" | pbcopy`);
                    fs.unlinkSync(tempFile);
                    console.log('\n✅ 已复制到剪贴板！');
                } catch (copyError) {
                    console.log('\n❌ 复制到剪贴板失败:', copyError.message);
                }
                process.exit(0);
            }
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
        const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
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
            const tempFile = path.join(os.tmpdir(), `.temp_commit_msg_${Date.now()}`);
            fs.writeFileSync(tempFile, commitMessage, 'utf8');
            execCommand(`cat "${tempFile}" | pbcopy`);
            fs.unlinkSync(tempFile); // 删除临时文件
            console.log('\n✅ 已复制到剪贴板！');
        } catch (copyError) {
            console.log('\n❌ 复制到剪贴板失败:', copyError.message);
        }

        // 给用户选择是否执行 commit
        const isCommit = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'isCommit',
                message: '是否执行 commit？(default no)',
                default: false,
            }
        ]);

        if (!isCommit.isCommit) {
            console.log('❌ 用户选择不执行 commit');
            process.exit(0);
        }

        // 执行 git add 和 commit
        console.log('\n执行 git add...');
        execCommand('git add .');
        console.log('✅ git add 成功！');

        console.log('\n执行 git commit...');
        execCommand(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);
        console.log('✅ commit 成功！');

        // 选择是否执行 git push
        const isPush = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'isPush',
                message: '是否执行 git push？(default no)',
                default: false,
            }
        ]);
        if (!isPush.isPush) {
            console.log('❌ 用户选择不执行 git push');
            process.exit(0);
        }
        execCommand('git push');
        console.log('✅ push 成功！');
    } catch (err) {
        console.error('\n❌ 错误详情:');
        if (err.stderr) {
            console.error(err.stderr.toString());
        }
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

