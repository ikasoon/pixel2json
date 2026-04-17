export type PixelCell = 0 | 1;
export type PixelGrid = PixelCell[][];

export type GridSize = {
	rows: number;
	cols: number;
};

export const DEFAULT_GRID_SIZE: GridSize = {
	rows: 16,
	cols: 16
};

export const MIN_GRID_SIZE = 1;
export const MAX_GRID_SIZE = 64;

export function createGrid(rows: number, cols: number): PixelGrid {
	return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
}

export function clearGrid(grid: PixelGrid): PixelGrid {
	return createGrid(grid.length, grid[0]?.length ?? 0);
}

export function toggleCell(grid: PixelGrid, row: number, col: number): PixelGrid {
	const nextValue: PixelCell = grid[row][col] === 1 ? 0 : 1;

	return paintCell(grid, row, col, nextValue);
}

export function paintCell(grid: PixelGrid, row: number, col: number, value: PixelCell): PixelGrid {
	if (grid[row]?.[col] === undefined || grid[row][col] === value) {
		return grid;
	}

	return grid.map((line, lineIndex) =>
		lineIndex === row ? line.map((cell, colIndex) => (colIndex === col ? value : cell)) : line
	);
}

export function serializeGrid(grid: PixelGrid): string {
	return JSON.stringify(grid, null, 2);
}

export function parseGridDimension(value: string): number | null {
	const trimmed = value.trim();

	if (trimmed.length === 0) {
		return null;
	}

	const parsed = Number(trimmed);

	if (!Number.isInteger(parsed) || parsed < MIN_GRID_SIZE || parsed > MAX_GRID_SIZE) {
		return null;
	}

	return parsed;
}
