export type TreeMode = 'all' | 'folders-only' | 'files-only';

export interface TreeOptions {
    mode: TreeMode;
    includeHidden: boolean;
    maxDepth: number;
    excludedDirs: string[];
    excludedExts: string[];
}


/**
 * Разбирает строку, введённую пользователем через запятую, в массив строк.
 *
 * @param input Строка с элементами, разделёнными запятыми. Может быть пустой.
 * 
 * @returns Массив непустых строк без окружающих пробелов. Для пустой строки
 *          или строки из одних запятых вернёт `[]`.
 *
 * @examples
 * parseList('node_modules, .git ,  dist,')
 * // → ['node_modules', '.git', 'dist']
 *
 * parseList('')
 * // → []
 */
export function parseList(input: string): string[] {
    return input.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Приводит список расширений файлов к единому виду для сравнения.
 *
 *
 * @param list Список расширений в произвольном регистре, с точкой или без.
 * 
 * @returns Новый массив расширений в нижнем регистре, каждое начинается с точки.
 *
 * @example
 * normalizeExts(['LOG', '.map', 'Min.JS'])
 * // → ['.log', '.map', '.min.js']
 *
 * normalizeExts([])
 * // → []
 */
export function normalizeExts(list: string[]): string[] {
    return list.map(e => {
        const lower = e.toLowerCase().trim();
        return lower.startsWith('.') ? lower : '.' + lower;
    });
}


