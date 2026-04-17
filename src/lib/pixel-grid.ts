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
	if (grid.length === 0) {
		return '[]';
	}

	const rows = grid.map((row) => `  [${row.join(', ')}]`);

	return `[\n${rows.join(',\n')}\n]`;
}

export function getCircleCells(row: number, col: number, radius: number, maxRows: number, maxCols: number): {r: number, c: number}[] {
	const cells: {r: number, c: number}[] = [];
	for (let r = Math.max(0, row - radius); r <= Math.min(maxRows - 1, row + radius); r++) {
		for (let c = Math.max(0, col - radius); c <= Math.min(maxCols - 1, col + radius); c++) {
			// Distance squared
			if (Math.pow(r - row, 2) + Math.pow(c - col, 2) <= Math.pow(radius, 2)) {
				cells.push({r, c});
			}
		}
	}
	return cells;
}

export function paintCells(grid: PixelGrid, cells: {r: number, c: number}[], value: PixelCell): PixelGrid {
	const newGrid = [...grid];
	let modified = false;

	cells.forEach(({r, c}) => {
		if (newGrid[r] && newGrid[r][c] !== undefined && newGrid[r][c] !== value) {
			if (newGrid[r] === grid[r]) {
				newGrid[r] = [...grid[r]];
			}
			newGrid[r][c] = value;
			modified = true;
		}
	});

	return modified ? newGrid : grid;
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

export function applyShape(grid: PixelGrid, shape: 'plus' | 'cross'): PixelGrid {
	const rows = grid.length;
	const cols = grid[0]?.length ?? 0;
	if (rows === 0 || cols === 0) return grid;

	const newGrid = createGrid(rows, cols);

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			if (shape === 'plus') {
				const isCenterRow = r === Math.floor(rows / 2) || (rows % 2 === 0 && r === Math.floor(rows / 2) - 1);
				const isCenterCol = c === Math.floor(cols / 2) || (cols % 2 === 0 && c === Math.floor(cols / 2) - 1);
				if (isCenterRow || isCenterCol) {
					newGrid[r][c] = 1;
				}
			} else if (shape === 'cross') {
				const expectedC1 = Math.round((r * (cols - 1)) / Math.max(1, rows - 1));
				const expectedC2 = Math.round(((rows - 1 - r) * (cols - 1)) / Math.max(1, rows - 1));
				if (c === expectedC1 || c === expectedC2) {
					newGrid[r][c] = 1;
				}
			}
		}
	}

	return newGrid;
}
