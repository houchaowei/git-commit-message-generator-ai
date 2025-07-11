#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取命令参数
const args = process.argv.slice(2);
if (args.length === 0 || !['h5', 'admin'].includes(args[0].toLowerCase())) {
    console.error('用法: npx gvc [h5|admin]');
    process.exit(1);
}
const mode = args[0].toLowerCase();

// 路径定义
const rootDir = process.cwd();
const templateDir = path.join(__dirname, 'template', mode === 'h5' ? 'H5' : 'admin', '.vscode');

// 递增生成唯一的 .vscode 目标目录
function getUniqueVscodeDir(baseDir) {
    let dir = path.join(baseDir, '.vscode');
    let i = 1;
    while (fs.existsSync(dir)) {
        dir = path.join(baseDir, `.vscode-${i}`);
        i++;
    }
    return dir;
}
const targetDir = getUniqueVscodeDir(rootDir);

// 动态获取 node/npm 路径
function getBinPath(bin) {
    try {
        return execSync(`which ${bin}`).toString().trim();
    } catch {
        return '';
    }
}
const nodePath = getBinPath('node');
const npmPath = getBinPath('npm');
const nodeBinDir = path.dirname(nodePath);

// 需要处理的文件
const files = ['launch.json', 'tasks.json'];

if (!fs.existsSync(templateDir)) {
    console.error(`模板目录不存在: ${templateDir}`);
    process.exit(1);
}
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir);
}

// 变量自动获取优先表
const autoVars = {
    NODE_PATH: nodePath,
    NPM_PATH: npmPath,
    NODE_BIN_DIR: nodeBinDir
};

// 统一收集所有模板变量
async function collectVars(varNames) {
    const questions = [];
    for (const varName of varNames) {
        if (autoVars[varName]) continue;
        // 针对常用变量给出默认值
        let defaultValue = '';
        if (varName.toLowerCase() === 'port') defaultValue = '8000';
        if (varName === 'npmPath') defaultValue = npmPath;
        if (varName === 'nodeBinDir') defaultValue = nodeBinDir;
        // 兼容大写变量
        if (varName === 'NPM_PATH') defaultValue = npmPath;
        if (varName === 'NODE_BIN_DIR') defaultValue = nodeBinDir;
        questions.push({
            type: 'input',
            name: varName,
            message: `请输入变量 ${varName} 的值:`,
            default: defaultValue
        });
    }
    if (questions.length === 0) return {};
    return await inquirer.prompt(questions);
}

(async () => {
    for (const file of files) {
        const srcFile = path.join(templateDir, file);
        const destFile = path.join(targetDir, file);
        if (!fs.existsSync(srcFile)) continue;
        if (fs.existsSync(destFile)) {
            console.log(`已存在，跳过: ${destFile}`);
            continue;
        }
        let content = fs.readFileSync(srcFile, 'utf8');
        // 查找所有 {{VAR}} 占位符
        const varMatches = [...content.matchAll(/\{\{([A-Z0-9_]+)\}\}/gi)];
        let varMap = {};
        const varNames = Array.from(new Set(varMatches.map(m => m[1])));
        // 自动变量
        for (const varName of varNames) {
            if (autoVars[varName]) {
                varMap[varName] = autoVars[varName];
            }
        }
        // 交互式变量
        const userVars = await collectVars(varNames);
        Object.assign(varMap, userVars);
        // 替换所有变量
        for (const [k, v] of Object.entries(varMap)) {
            content = content.replace(new RegExp(`\{\{${k}\}\}`, 'g'), v);
        }
        fs.writeFileSync(destFile, content, 'utf8');
        console.log(`已生成: ${destFile}`);
    }
    console.log(`全部生成完毕，配置目录为: ${targetDir}`);
})(); 