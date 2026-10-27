// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "file-tree-generator" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    
    const helloWorldCommand = vscode.commands.registerCommand('file-tree-generator.helloWorld', () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World from file-tree-generator!');
    });

    const generateTreeCommand = vscode.commands.registerCommand('file-tree-generator.generateTree', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const defaultPath = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';

        const targetDirectory = await vscode.window.showInputBox({
            prompt: 'Введите абсолютный путь к директории или оставьте пустым для текущей папки',
            value: defaultPath,
            placeHolder: 'Например: /home/sasha/project'
        });

        if (targetDirectory === undefined) {
            return;
        }

        if (!targetDirectory || !fs.existsSync(targetDirectory)) {
            vscode.window.showErrorMessage('Указанная директория не существует или путь пуст!');
            return;
        }

        vscode.window.showInformationMessage('Генерация карты директории...');
        const rootName = path.basename(targetDirectory) || targetDirectory;
        let treeResult = `${rootName}/\n`;
        treeResult += buildTree(targetDirectory, '');

        const document = await vscode.workspace.openTextDocument({
            content: treeResult,
            language: 'text'
        });
        await vscode.window.showTextDocument(document);
    });

    context.subscriptions.push(helloWorldCommand, generateTreeCommand);
}


function buildTree(currentPath: string, prefix: string): string {
    let result = '';

    try {
        const items = fs.readdirSync(currentPath);
        
        items.forEach((item, index) => {
            const isLast = index === items.length - 1;
            const itemPath = path.join(currentPath, item);
            const isDirectory = fs.statSync(itemPath).isDirectory();

            const pointer = isLast ? '--- ' : '|-- ';
            result += `${prefix}${pointer}${item}${isDirectory ? '/' : ''}\n`;

            if (isDirectory) {
                const nextPrefix = prefix + (isLast ? '    ' : '|   ');
                result += buildTree(itemPath, nextPrefix);
            }
        });
    } catch (error: any) {
        result += `${prefix}└── [Ошибка доступа: ${error.message}]\n`;
    }

    return result;
}
