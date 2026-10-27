export type TreeMode = 'all' | 'folders-only' | 'files-only';

export interface TreeOptions {
    mode: TreeMode;
    includeHidden: boolean;
    maxDepth: number;
    excludedDirs: string[];
    excludedExts: string[];
}


export function parseList(input: string): string[] {
    return input.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

export function normalizeExts(list: string[]): string[] {
    return list.map(e => {
        const lower = e.toLowerCase().trim();
        return lower.startsWith('.') ? lower : '.' + lower;
    });
}


