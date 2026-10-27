import * as vscode from 'vscode';
import * as fs from 'fs';
import { buildTree } from './treeBuilder';
import { TreeOptions } from './options';


export function activate(context: vscode.ExtensionContext) {
    const generateTree = vscode.commands.registerCommand('file-tree-generator.generateTree', async () => {
        const folders = vscode.workspace.workspaceFolders;
        const defaultPath = folders && folders.length > 0
            ? folders[0].uri.fsPath
            : '';

        const picked = await pickDirectory(defaultPath);
        if (picked === undefined) {
            return; // пользователь отменил
        }

        if (!fs.existsSync(picked) || !fs.statSync(picked).isDirectory()) {
            vscode.window.showErrorMessage('Указанный путь не является директорией.');
            return;
        }

        const config = vscode.workspace.getConfiguration('file-tree-generator');
        const rawDepth = config.get<number>('maxDepth', 0);
        const options: TreeOptions = {
            mode: config.get<'all' | 'folders-only' | 'files-only'>('mode', 'all'),
            includeHidden: config.get<boolean>('includeHidden', false),
            maxDepth: rawDepth === 0 ? Infinity : rawDepth,
            excludedDirs: config.get<string[]>('excludedDirs', []),
            excludedExts: config.get<string[]>('excludedExts', [])
        };

        vscode.window.showInformationMessage('Генерация карты директории...');
        const tree = buildTree(picked, options);

        const doc = await vscode.workspace.openTextDocument({
            content: tree,
            language: 'text'
        });
        await vscode.window.showTextDocument(doc, { preview: false });
    });

    context.subscriptions.push(generateTree);
}

async function pickDirectory(defaultPath: string): Promise<string | undefined> {
    const browseButton: vscode.QuickInputButton = {
        iconPath: new vscode.ThemeIcon('folder-opened'),
        tooltip: 'Выбрать папку…'
    };

    const input = vscode.window.createInputBox();
    input.title = 'Корневая папка для дерева';
    input.prompt = 'Введите путь или нажмите иконку папки справа';
    input.value = defaultPath;
    input.buttons = [browseButton];

    return new Promise<string | undefined>(resolve => {
        let resolved = false;

        input.onDidTriggerButton(async () => {
            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                defaultUri: defaultPath ? vscode.Uri.file(defaultPath) : undefined,
                openLabel: 'Выбрать эту папку'
            });
            if (uri && uri.length > 0) {
                resolved = true;
                input.hide();
                resolve(uri[0].fsPath);
            }
        });

        input.onDidAccept(() => {
            resolved = true;
            const value = input.value.trim();
            input.hide();
            resolve(value.length > 0 ? value : undefined);
        });

        input.onDidHide(() => {
            if (!resolved) {
                resolve(undefined);
            }
            input.dispose();
        });

        input.show();
    });
}