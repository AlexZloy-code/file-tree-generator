import * as fs from 'fs';
import * as path from 'path';
import { TreeOptions, normalizeExts } from './options';


/**
 * Строит текстовое дерево каталогов (псевдографика `├──`, `└──`, `│`).
 *
 * Функция:
 *  - читает содержимое `rootPath` рекурсивно, начиная с корня;
 *  - фильтрует элементы по настройкам {@link TreeOptions}:
 *    скрытые, исключённые папки, исключённые расширения, режим (`mode`);
 *  - сортирует элементы: сначала папки, затем файлы, внутри группы — по алфавиту;
 *  - в режиме `'files-only'` не выводит папки, внутри которых нет видимых файлов;
 *  - при ошибке доступа к папке вставляет строку `[Ошибка доступа: …]`
 *    и продолжает обход, не прерывая всю генерацию.
 *
 * @param rootPath Абсолютный путь к корневой директории. Не проверяется на
 *                 существование — ответственность вызывающего кода.
 * 
 * @param options  Настройки обхода. См. {@link TreeOptions}.
 * 
 * @returns Готовая строка с деревом. Первая строка — имя корневой папки
 *          с завершающим `/`. Строки разделены `\n`, в конце строки тоже `\n`.
 *
 * @example
 * buildTree('/home/sasha/project', {
 *     mode: 'all',
 *     includeHidden: false,
 *     maxDepth: Infinity,
 *     excludedDirs: ['node_modules'],
 *     excludedExts: ['.log']
 * });
 * // → 'project/
 *       ├── src/
 *       │   └── extension.ts
 *       └── package.json'
 */
export function buildTree(rootPath: string, options: TreeOptions): string {
    const rootName = path.basename(rootPath) || rootPath;
    const lines: string[] = [`${rootName}/`];

    const excludedDirs = new Set(options.excludedDirs);
    const excludedExts = new Set(normalizeExts(options.excludedExts));

    walk(rootPath, '', 0);
    return lines.join('\n') + '\n';

    /**
     * Рекурсивно обходит директорию `currentPath` и добавляет строки
     * с её содержимым в общий массив `lines` (замыкание `buildTree`).
     *
     * На каждом уровне:
     *  1. Проверяет ограничение глубины (`depth >= options.maxDepth`) — если
     *     превышено, обход ветки прекращается.
     *  2. Читает содержимое папки. При ошибке добавляет в дерево строку
     *     `[Ошибка доступа: …]` и возвращает управление.
     *  3. Фильтрует элементы по `includeHidden`, `excludedDirs`, `excludedExts`
     *     и `mode` (`'folders-only'` отбрасывает файлы).
     *  4. Сортирует: сначала папки, затем файлы, внутри группы — `localeCompare`.
     *  5. Для каждой записи рисует ветку (`├──` или `└──`) с префиксом,
     *     унаследованным от родителя, и, если это папка, рекурсивно вызывает
     *     себя с обновлённым префиксом (`    ` или `│   `).
     *
     * В режиме `'files-only'` папка пропускается целиком, если внутри неё нет
     * ни одного видимого файла (см. {@link hasVisibleFiles}).
     *
     * @param currentPath Абсолютный путь к текущей обрабатываемой директории.
     * 
     * @param prefix      Строка-префикс, накопленная от родительских уровней
     *                    (`''` для корня, далее комбинация `'    '` и `'│   '`).
     * @param depth       Текущая глубина рекурсии: `0` для корня, `1` для первого
     *                    уровня вложенности и т.д. Сравнивается с `options.maxDepth`.
     *
     * @returns Ничего. Результат накапливается в замыкании `lines`.
     */

    function walk(currentPath: string, prefix: string, depth: number): void {
        if (depth >= options.maxDepth) {
            return;
        }

        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(currentPath, { withFileTypes: true });
        } catch (err: any) {
            lines.push(`${prefix}└── [Ошибка доступа: ${err.message}]`);
            return;
        }

        const visible = entries.filter(entry => {
            const name = entry.name;
            const isDir = entry.isDirectory();

            if (!options.includeHidden && name.startsWith('.')) {
                return false;
            }

            if (isDir && excludedDirs.has(name)) {
                return false;
            }

            if (!isDir && excludedExts.size > 0) {
                const ext = path.extname(name).toLowerCase();
                if (excludedExts.has(ext)) {
                    return false;
                }
            }

            if (options.mode === 'folders-only' && !isDir) {
                return false;
            }

            return true;
        });

        visible.sort((a, b) => {
            const aDir = a.isDirectory() ? 0 : 1;
            const bDir = b.isDirectory() ? 0 : 1;
            if (aDir !== bDir) return aDir - bDir;
            return a.name.localeCompare(b.name);
        });


        visible.forEach((entry, index) => {
            const isLast = index === visible.length - 1;
            const isDir = entry.isDirectory();
            const pointer = isLast ? '└── ' : '├── ';
            const suffix = isDir ? '/' : '';

            if (options.mode === 'files-only' && isDir) {
                const childPath = path.join(currentPath, entry.name);
                if (!hasVisibleFiles(childPath, options, 0)) {
                    return;
                }
            }

            lines.push(`${prefix}${pointer}${entry.name}${suffix}`);

            if (isDir) {
                const nextPrefix = prefix + (isLast ? '    ' : '│   ');
                walk(path.join(currentPath, entry.name), nextPrefix, depth + 1);
            }
        });
    }

    /**
     * Проверяет, есть ли внутри директории `dirPath` хотя бы один файл,
     * который прошёл бы все фильтры `TreeOptions`.
     *
     * Используется только в режиме `'files-only'`, чтобы не выводить пустые
     * папки: если внутри нет ни одного «видимого» файла (ни прямого, ни
     * вложенного), папка вместе со своим поддеревом пропускается.
     *
     * Рекурсивно спускается во вложенные директории, но:
     *  - не заходит в исключённые папки (`excludedDirs`);
     *  - не учитывает скрытые элементы, если `includeHidden === false`;
     *  - не учитывает файлы с исключёнными расширениями;
     *  - останавливается при достижении `maxDepth`.
     *
     * Проверка прекращается при первом найденном подходящем файле
     * (short-circuit), поэтому на типичных проектах работает быстро.
     *
     * @param dirPath      Абсолютный путь к проверяемой директории.
     * 
     * @param opts         Те же настройки обхода, что переданы в {@link buildTree}.
     * 
     * @param currentDepth Текущая глубина рекурсии относительно `dirPath`:
     *                     `0` для самой `dirPath`, `1` для её детей и т.д.
     * @returns `true`, если найден хотя бы один видимый файл; иначе `false`.
     *          При ошибке чтения директории (нет прав и т.п.) возвращает `false`.
     */
    function hasVisibleFiles(dirPath: string, opts: TreeOptions, currentDepth: number): boolean {
        if (currentDepth >= opts.maxDepth) {
            return false;
        }
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dirPath, { withFileTypes: true });
        } catch {
            return false;
        }

        const excluded = new Set(opts.excludedDirs);
        const exts = new Set(normalizeExts(opts.excludedExts));

        for (const entry of entries) {
            const isDir = entry.isDirectory();
            if (!opts.includeHidden && entry.name.startsWith('.')) continue;
            if (isDir && excluded.has(entry.name)) continue;
            if (!isDir && exts.size > 0) {
                const ext = path.extname(entry.name).toLowerCase();
                if (exts.has(ext)) continue;
            }
            if (isDir) {
                if (hasVisibleFiles(path.join(dirPath, entry.name), opts, currentDepth + 1)) {
                    return true;
                }
            } else {
                return true;
            }
        }
        return false;
    }
}