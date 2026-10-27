import * as vscode from 'vscode';
import * as fs from 'fs';
import { buildTree } from './treeBuilder';
import { TreeOptions } from './options';

/**
 * Точка входа расширения. Вызывается VS Code один раз при первой
 * активации (например, при первом запуске команды
 * `file-tree-generator.generateTree`).
 *
 * Регистрирует команду `file-tree-generator.generateTree`, которая:
 *  1. Берёт путь по умолчанию из первой папки рабочей области
 *     (`vscode.workspace.workspaceFolders[0]`), если она открыта.
 *  2. Запрашивает у пользователя корневую папку через {@link pickDirectory}
 *     (поле ввода + кнопка «Обзор» с системным диалогом).
 *  3. Проверяет, что выбранный путь существует и является директорией.
 *  4. Читает настройки из `Ctrl+,` через
 *     `vscode.workspace.getConfiguration('file-tree-generator')`
 *     и собирает объект {@link TreeOptions}. Значение `maxDepth = 0`
 *     трактуется как «без ограничений» и превращается в `Infinity`.
 *  5. Вызывает {@link buildTree} и открывает результат в новом
 *     текстовом документе (`preview: false`, чтобы вкладка не закрывалась
 *     при переключении).
 *
 * Все зарегистрированные команды и другие `Disposable`-объекты
 * добавляются в `context.subscriptions`, чтобы VS Code корректно
 * освобождал ресурсы при деактивации расширения.
 *
 * @param context Контекст расширения, предоставляемый VS Code.
 *                Через него регистрируются команды и хранятся подписки.
 */
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

/**
 * Запрашивает у пользователя путь к директории через `InputBox`
 * с дополнительной кнопкой «Обзор», открывающей системный диалог
 * выбора папки.
 *
 * Механика:
 *  - создаётся `InputBox` с предзаполненным `defaultPath`;
 *  - справа добавляется кнопка с иконкой `folder-opened`;
 *  - при клике на кнопку вызывается `vscode.window.showOpenDialog`
 *    с `canSelectFolders: true`, `canSelectFiles: false`;
 *  - при нажатии `Enter` в поле ввода возвращается введённая строка
 *    (или `undefined`, если она пустая после `trim`);
 *  - при закрытии `InputBox` без подтверждения (Esc, потеря фокуса)
 *    возвращается `undefined`.
 *
 * Функция гарантирует, что `Promise` разрешится ровно один раз:
 * флаг `resolved` защищает от двойного вызова `resolve` при
 * комбинации «нажали кнопку → выбрали папку → InputBox скрылся».
 *
 * @param defaultPath Путь, который будет подставлен в поле ввода по
 *                    умолчанию. Может быть пустой строкой.
 * @returns Абсолютный путь к выбранной директории, введённый вручную
 *          или выбранный в диалоге. `undefined`, если пользователь
 *          отменил ввод или закрыл `InputBox` без подтверждения.
 *
 * @example
 * const dir = await pickDirectory('/home/sasha/project');
 * if (dir === undefined) {
 *     return; // пользователь отменил
 * }
 */

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