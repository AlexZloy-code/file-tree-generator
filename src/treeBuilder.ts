import * as fs from 'fs';
import * as path from 'path';
import { TreeOptions, normalizeExts } from './options';

export function buildTree(rootPath: string, options: TreeOptions): string {
    const rootName = path.basename(rootPath) || rootPath;
    const lines: string[] = [`${rootName}/`];

    const excludedDirs = new Set(options.excludedDirs);
    const excludedExts = new Set(normalizeExts(options.excludedExts));

    walk(rootPath, '', 0);
    return lines.join('\n') + '\n';

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