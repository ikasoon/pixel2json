<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fade, slide } from 'svelte/transition';

	import {
		DEFAULT_GRID_SIZE,
		MAX_GRID_SIZE,
		MIN_GRID_SIZE,
		applyShape,
		clearGrid,
		createGrid,
		parseGridDimension,
		paintCell,
		serializeGrid,
		toggleCell,
		getCircleCells,
		paintCells,
		type PixelCell,
		type PixelGrid
	} from '$lib/pixel-grid';

	const dimensionHint = `1-${MAX_GRID_SIZE}`;

	let rowInput = $state(String(DEFAULT_GRID_SIZE.rows));
	let colInput = $state(String(DEFAULT_GRID_SIZE.cols));
	let grid = $state<PixelGrid>(createGrid(DEFAULT_GRID_SIZE.rows, DEFAULT_GRID_SIZE.cols));
	let copyFeedback = $state('');
	let copyState = $state<'idle' | 'success' | 'error'>('idle');
	let isDarkMode = $state(false);

	const parsedRows = $derived(parseGridDimension(rowInput));
	const parsedCols = $derived(parseGridDimension(colInput));
	const rowCount = $derived(grid.length);
	const colCount = $derived(grid[0]?.length ?? 0);
	
	let debouncedGrid = $state<PixelGrid>([]);
	$effect(() => {
		const g = grid;
		let handle = requestAnimationFrame(() => {
			debouncedGrid = g;
		});
		return () => cancelAnimationFrame(handle);
	});

	const jsonPreview = $derived(serializeGrid(debouncedGrid.length ? debouncedGrid : grid));
	const canApplySize = $derived(
		parsedRows !== null &&
			parsedCols !== null &&
			(parsedRows !== rowCount || parsedCols !== colCount)
	);
	const toolbarMessage = $derived(
		parsedRows === null || parsedCols === null
			? `가로와 세로는 ${dimensionHint} 사이의 정수만 입력할 수 있습니다.`
			: canApplySize
				? `적용하면 ${parsedCols} x ${parsedRows} 그리드로 다시 시작합니다.`
				: `현재 ${colCount} x ${rowCount} / 입력 범위 ${dimensionHint}`
	);

	let activePointerId = $state<number | null>(null);
	let paintValue: PixelCell = 1;
	let visitedCells: Record<string, true> = {};
	let copyFeedbackTimer: ReturnType<typeof setTimeout> | undefined;

	let brushSize = $state<number>(0);
	
	let gridContainer: HTMLDivElement | undefined = $state();
	let currentHoverR: number | null = null;
	let currentHoverC: number | null = null;
	let lastHoveredCells: {r: number, c: number}[] = [];

	function updateHoverState(r: number | null, c: number | null): void {
		currentHoverR = r;
		currentHoverC = c;

		if (!gridContainer) return;
		
		const buttons = gridContainer.children;
		const cols = colCount;

		for (const { r: oldR, c: oldC } of lastHoveredCells) {
			const idx = oldR * cols + oldC;
			const btn = buttons[idx];
			if (btn) btn.classList.remove('hover');
		}

		if (r === null || c === null) {
			lastHoveredCells = [];
			return;
		}

		lastHoveredCells = getCircleCells(r, c, brushSize, rowCount, colCount);
		for (const { r: newR, c: newC } of lastHoveredCells) {
			const idx = newR * cols + newC;
			const btn = buttons[idx];
			if (btn) btn.classList.add('hover');
		}
	}

	$effect(() => {
		// Re-apply hover if brush size changes while hovering
		brushSize;
		if (currentHoverR !== null && currentHoverC !== null) {
			updateHoverState(currentHoverR, currentHoverC);
		}
	});

	onDestroy(() => {
		if (copyFeedbackTimer) {
			clearTimeout(copyFeedbackTimer);
		}
	});

	function getCellKey(row: number, col: number): string {
		return `${row}:${col}`;
	}

	function setCopyFeedback(state: 'success' | 'error', message: string): void {
		copyState = state;
		copyFeedback = message;

		if (copyFeedbackTimer) {
			clearTimeout(copyFeedbackTimer);
		}

		copyFeedbackTimer = setTimeout(() => {
			copyState = 'idle';
			copyFeedback = '';
		}, 2200);
	}

	function handleColInput(event: Event): void {
		colInput = (event.currentTarget as HTMLInputElement).value;
	}

	function handleRowInput(event: Event): void {
		rowInput = (event.currentTarget as HTMLInputElement).value;
	}

	function applyPaint(row: number, col: number): void {
		const cellsToPaint = getCircleCells(row, col, brushSize, rowCount, colCount);
		const unvisitedCells = cellsToPaint.filter(c => !visitedCells[getCellKey(c.r, c.c)]);

		if (unvisitedCells.length === 0) {
			return;
		}

		for (const { r, c } of unvisitedCells) {
			grid[r][c] = paintValue;
			visitedCells[getCellKey(r, c)] = true;
		}
	}

	function beginPaint(event: PointerEvent, row: number, col: number): void {
		if (!event.isPrimary) {
			return;
		}

		if (event.pointerType === 'mouse' && event.button !== 0) {
			return;
		}

		event.preventDefault();
		activePointerId = event.pointerId;
		paintValue = grid[row][col] === 1 ? 0 : 1;
		visitedCells = {};
		applyPaint(row, col);
	}

	function continuePaint(event: PointerEvent, row: number, col: number): void {
		if (activePointerId !== event.pointerId) {
			return;
		}

		applyPaint(row, col);
	}

	function endPaint(event?: PointerEvent): void {
		if (event && activePointerId !== event.pointerId) {
			return;
		}

		activePointerId = null;
		visitedCells = {};
	}

	function getCellFromEvent(event: Event): { r: number; c: number } | null {
		const target = event.target as HTMLElement;
		if (!target || !target.getAttribute) return null;
		const r = target.getAttribute('data-r');
		const c = target.getAttribute('data-c');
		if (r !== null && c !== null) {
			return { r: parseInt(r, 10), c: parseInt(c, 10) };
		}
		return null;
	}

	function handleGridPointerDown(event: PointerEvent): void {
		const cell = getCellFromEvent(event);
		if (cell) {
			beginPaint(event, cell.r, cell.c);
		}
	}

	function handleGridPointerOver(event: PointerEvent): void {
		const cell = getCellFromEvent(event);
		if (cell) {
			if (currentHoverR !== cell.r || currentHoverC !== cell.c) {
				updateHoverState(cell.r, cell.c);
			}
			continuePaint(event, cell.r, cell.c);
		}
	}

	function handleGridPointerLeave(): void {
		updateHoverState(null, null);
	}

	function handleGridKeyDown(event: KeyboardEvent): void {
		const cell = getCellFromEvent(event);
		if (cell) {
			if (event.key !== ' ' && event.key !== 'Enter') {
				return;
			}
			event.preventDefault();
			const cellsToPaint = getCircleCells(cell.r, cell.c, brushSize, rowCount, colCount);
			const nextValue: PixelCell = grid[cell.r][cell.c] === 1 ? 0 : 1;
			for (const { r, c } of cellsToPaint) {
				grid[r][c] = nextValue;
			}
		}
	}

	function incrementDimension(input: string, setInput: (v: string) => void): void {
		const current = parseInt(input, 10) || 0;
		if (current < MAX_GRID_SIZE) {
			setInput(String(current + 1));
		}
	}

	function decrementDimension(input: string, setInput: (v: string) => void): void {
		const current = parseInt(input, 10) || 0;
		if (current > MIN_GRID_SIZE) {
			setInput(String(current - 1));
		}
	}

	function handleSizeSubmit(event: SubmitEvent): void {
		event.preventDefault();

		if (!canApplySize || parsedRows === null || parsedCols === null) {
			return;
		}

		grid = createGrid(parsedRows, parsedCols);
		rowInput = String(parsedRows);
		colInput = String(parsedCols);
		endPaint();
	}

	function handleShape(shape: 'plus' | 'cross'): void {
		grid = applyShape(grid, shape);
		endPaint();
	}

	function resetGrid(): void {
		grid = clearGrid(grid);
		endPaint();
	}

	async function copyJson(): Promise<void> {
		try {
			await navigator.clipboard.writeText(jsonPreview);
			setCopyFeedback('success', 'JSON을 복사했습니다.');
		} catch {
			setCopyFeedback('error', '복사에 실패했습니다.');
		}
	}
</script>

<svelte:head>
	<title>Pixel Grid JSON</title>
	<meta
		name="description"
		content="Draw a pixel grid and convert it into a 0/1 JSON two-dimensional list."
	/>
</svelte:head>

<svelte:window onpointerup={endPaint} onpointercancel={endPaint} />

<div class="page-shell" class:dark={isDarkMode}>
	<header class="page-header">
		<div class="header-main">
			<div>
				<p class="eyebrow">PIXEL2JSON</p>
				<h1>픽셀을 그리고 바로 JSON으로 변환하세요.</h1>
			</div>
			<button class="theme-toggle" onclick={() => (isDarkMode = !isDarkMode)} aria-label="테마 전환">
				{#if isDarkMode}
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
				{/if}
			</button>
		</div>
		<p class="header-copy">
			클릭으로 한 칸씩 토글하고, 드래그로 여러 칸을 한 번에 칠할 수 있습니다.
		</p>
	</header>

	<form class="toolbar" onsubmit={handleSizeSubmit}>
		<label class="field">
			<span>가로</span>
			<div class="number-input-wrapper">
				<button type="button" class="num-btn" onclick={() => decrementDimension(colInput, (v) => colInput = v)} aria-label="감소">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
				</button>
				<input
					type="number"
					min="1"
					max={MAX_GRID_SIZE}
					inputmode="numeric"
					value={colInput}
					oninput={handleColInput}
				/>
				<button type="button" class="num-btn" onclick={() => incrementDimension(colInput, (v) => colInput = v)} aria-label="증가">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
				</button>
			</div>
		</label>

		<label class="field">
			<span>세로</span>
			<div class="number-input-wrapper">
				<button type="button" class="num-btn" onclick={() => decrementDimension(rowInput, (v) => rowInput = v)} aria-label="감소">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
				</button>
				<input
					type="number"
					min="1"
					max={MAX_GRID_SIZE}
					inputmode="numeric"
					value={rowInput}
					oninput={handleRowInput}
				/>
				<button type="button" class="num-btn" onclick={() => incrementDimension(rowInput, (v) => rowInput = v)} aria-label="증가">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
				</button>
			</div>
		</label>

		<button type="submit" class="primary apply-btn" disabled={!canApplySize}>적용</button>

		<div class="toolbar-actions">
			<div class="brush-size-group" role="group" aria-label="브러시 크기 선택">
				<span class="brush-label">브러시</span>
				<button type="button" class="brush-btn" class:active={brushSize === 0} onclick={() => brushSize = 0} aria-label="브러시 S">
					<div class="brush-icon size-s">
						<div></div>
					</div>
				</button>
				<button type="button" class="brush-btn" class:active={brushSize === 1} onclick={() => brushSize = 1} aria-label="브러시 M">
					<div class="brush-icon size-m">
						<div class="empty"></div><div class="fill"></div><div class="empty"></div>
						<div class="fill"></div><div class="fill"></div><div class="fill"></div>
						<div class="empty"></div><div class="fill"></div><div class="empty"></div>
					</div>
				</button>
				<button type="button" class="brush-btn" class:active={brushSize === 2} onclick={() => brushSize = 2} aria-label="브러시 L">
					<div class="brush-icon size-l">
						<div class="empty"></div><div class="empty"></div><div class="fill"></div><div class="empty"></div><div class="empty"></div>
						<div class="empty"></div><div class="fill"></div><div class="fill"></div><div class="fill"></div><div class="empty"></div>
						<div class="fill"></div><div class="fill"></div><div class="fill"></div><div class="fill"></div><div class="fill"></div>
						<div class="empty"></div><div class="fill"></div><div class="fill"></div><div class="fill"></div><div class="empty"></div>
						<div class="empty"></div><div class="empty"></div><div class="fill"></div><div class="empty"></div><div class="empty"></div>
					</div>
				</button>
			</div>
			<button type="button" onclick={() => handleShape('plus')}>+ 모양</button>
			<button type="button" onclick={() => handleShape('cross')}>x 모양</button>
			<button type="button" onclick={resetGrid}>초기화</button>
			<button type="button" onclick={copyJson}>JSON 복사</button>
		</div>

		<p class="toolbar-meta">
			{#key toolbarMessage}
				<span in:fade={{ duration: 150 }}>{toolbarMessage}</span>
			{/key}
		</p>
	</form>

	<div class="workspace">
		<section class="panel editor-panel" aria-labelledby="grid-title">
			<div class="panel-header">
				<div>
					<p class="panel-label">편집</p>
					<h2 id="grid-title">픽셀 그리드</h2>
				</div>
				<p class="panel-note">
					{activePointerId === null ? '셀을 클릭하거나 드래그하세요.' : '드래그 중입니다.'}
				</p>
			</div>

			<div class="grid-frame">
				<div
					class="pixel-grid"
					role="grid"
					aria-label={`Pixel grid ${colCount} by ${rowCount}`}
					style={`grid-template-columns: repeat(${colCount}, minmax(0, 1fr)); --cols: ${colCount}; --rows: ${rowCount};`}
					bind:this={gridContainer}
					onpointerdown={handleGridPointerDown}
					onpointerover={handleGridPointerOver}
					onpointerleave={handleGridPointerLeave}
					onkeydown={handleGridKeyDown}
				>
					{#each grid as line, rowIndex (rowIndex)}
						{#each line as cell, colIndex (`${rowIndex}:${colIndex}`)}
							<button
								type="button"
								class:active={cell === 1}
								aria-label={`Column ${colIndex + 1}, row ${rowIndex + 1}, ${cell === 1 ? 'selected' : 'empty'}`}
								aria-pressed={cell === 1}
								data-r={rowIndex}
								data-c={colIndex}
							></button>
						{/each}
					{/each}
				</div>
			</div>
		</section>

		<section class="panel json-panel" aria-labelledby="json-title">
			<div class="panel-header">
				<div>
					<p class="panel-label">미리보기</p>
					<h2 id="json-title">JSON</h2>
				</div>
				{#if copyFeedback}
					<p class={`copy-status ${copyState}`} in:slide={{ axis: 'x', duration: 200 }} out:fade>
						{copyFeedback}
					</p>
				{:else}
					<p class="copy-status idle">실시간으로 반영됩니다.</p>
				{/if}
			</div>

			<pre>{jsonPreview}</pre>
		</section>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family:
			'Inter Variable',
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		background: var(--bg-main);
		background-attachment: fixed;
		color: var(--text-primary);
		transition: background-color 0.3s ease, color 0.3s ease;
	}

	:global(button),
	:global(input) {
		font: inherit;
	}

	.page-shell {
		/* Light Theme (Default) */
		--bg-main: radial-gradient(circle at top, #f8fafc 0%, #f1f5f9 100%);
		--text-primary: #1e293b;
		--text-secondary: #475569;
		--text-muted: #64748b;
		--accent-primary: #3b82f6;
		--accent-hover: #2563eb;
		--accent-glow: rgba(59, 130, 246, 0.4);
		--panel-bg: rgba(255, 255, 255, 0.7);
		--panel-border: #e2e8f0;
		--panel-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.05);
		--input-bg: #ffffff;
		--button-bg: #f8fafc;
		--button-border: #e2e8f0;
		--grid-bg: #e2e8f0;
		--grid-frame-bg: #f8fafc;
		--grid-cell-bg: #ffffff;
		--grid-cell-hover: #f1f5f9;
		--json-bg: #ffffff;
		--json-text: #3b82f6;
		--json-border: #e2e8f0;
		--scrollbar-track: #f1f5f9;
		--scrollbar-thumb: #94a3b8;

		min-height: 100vh;
		padding: 40px 24px;
	}

	.page-shell.dark {
		/* Dark Tech Aesthetic */
		--bg-main: radial-gradient(circle at top, #18181b 0%, #09090b 100%);
		--text-primary: #f4f4f5;
		--text-secondary: #a1a1aa;
		--text-muted: #71717a;
		--accent-primary: #3b82f6;
		--accent-hover: #2563eb;
		--accent-glow: rgba(59, 130, 246, 0.4);
		--panel-bg: rgba(12, 12, 14, 0.6);
		--panel-border: #27272a;
		--panel-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.2);
		--input-bg: #09090b;
		--button-bg: #18181b;
		--button-border: #27272a;
		--grid-bg: #27272a;
		--grid-frame-bg: #000000;
		--grid-cell-bg: #09090b;
		--grid-cell-hover: #18181b;
		--json-bg: #000000;
		--json-text: #3b82f6;
		--json-border: #18181b;
		--scrollbar-track: #09090b;
		--scrollbar-thumb: #3f3f46;
	}

	.page-header {
		container-type: inline-size;
		display: grid;
		gap: 12px;
		margin: 0 auto 40px;
		max-width: 1536px;
	}

	.header-main {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 20px;
	}

	.theme-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 10px;
		border: 1px solid var(--panel-border);
		background: var(--panel-bg);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
		backdrop-filter: blur(12px);
	}

	.theme-toggle:hover {
		background: var(--button-bg);
		transform: translateY(-1px);
	}

	.eyebrow,
	.panel-label {
		margin: 0 0 8px;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--accent-primary);
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	h1 {
		max-width: none;
		font-size: clamp(1.25rem, 4cqi, 3rem);
		font-weight: 800;
		line-height: 1.1;
		letter-spacing: -0.02em;
	}

	h2 {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.header-copy {
		max-width: 56ch;
		font-size: 1.1rem;
		line-height: 1.6;
		color: var(--text-secondary);
	}

	.toolbar {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 9rem)) auto 1fr;
		gap: 16px;
		align-items: end;
		margin: 0 auto 24px;
		max-width: 1536px;
		padding: 20px;
		border: 1px solid var(--panel-border);
		border-radius: 12px;
		background: var(--panel-bg);
		backdrop-filter: blur(12px);
		box-shadow: var(--panel-shadow);
	}

	.field {
		display: grid;
		gap: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	input {
		min-width: 0;
		padding: 10px 14px;
		border: 1px solid var(--panel-border);
		border-radius: 8px;
		background: var(--input-bg);
		color: var(--text-primary);
		transition: border-color 0.2s ease;
		text-align: center;
		-moz-appearance: textfield;
	}

	input::-webkit-outer-spin-button,
	input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.number-input-wrapper {
		display: flex;
		align-items: center;
		background: var(--input-bg);
		border: 1px solid var(--panel-border);
		border-radius: 8px;
		overflow: hidden;
		transition: border-color 0.2s ease;
	}

	.number-input-wrapper:focus-within {
		border-color: var(--accent-primary);
	}

	.number-input-wrapper input {
		border: none;
		border-radius: 0;
		width: 50px;
		padding: 10px 0;
	}

	.num-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 40px;
		border: none;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.num-btn:hover {
		background: var(--button-bg);
		color: var(--accent-primary);
	}

	.num-btn:active {
		background: var(--panel-border);
	}

	input:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.toolbar-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		justify-content: flex-end;
	}

	.brush-size-group {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 4px 4px 12px;
		border: 1px solid var(--panel-border);
		border-radius: 10px;
		background: var(--input-bg);
	}

	.brush-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin-right: 2px;
	}

	.brush-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		padding: 0 !important;
		border: none !important;
		border-radius: 6px !important;
		background: transparent !important;
		box-shadow: none !important;
		cursor: pointer;
	}

	.brush-btn:hover {
		background: var(--button-bg) !important;
	}

	.brush-btn.active {
		background: var(--button-bg) !important;
	}

	.brush-icon {
		display: grid;
		gap: 1px;
	}

	.brush-icon div {
		width: 4px;
		height: 4px;
		border-radius: 0.5px;
		background: var(--text-muted);
		opacity: 0.4;
	}

	.brush-icon div.fill, .size-s div {
		background: var(--text-secondary);
		opacity: 1;
	}

	.brush-icon div.empty {
		background: transparent;
	}

	.brush-btn.active .brush-icon div.fill, .brush-btn.active .size-s div {
		background: var(--accent-primary);
	}

	.brush-icon.size-s {
		grid-template-columns: 1fr;
	}
	.brush-icon.size-s div {
		width: 6px;
		height: 6px;
	}

	.brush-icon.size-m {
		grid-template-columns: repeat(3, 1fr);
	}

	.brush-icon.size-l {
		grid-template-columns: repeat(5, 1fr);
	}

	.toolbar-actions button,
	.apply-btn {
		padding: 10px 18px;
		border: 1px solid var(--panel-border);
		border-radius: 8px;
		background: var(--button-bg);
		color: var(--text-primary);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.toolbar-actions button.primary,
	.apply-btn.primary {
		border-color: var(--accent-primary);
		background: var(--accent-primary);
		color: #ffffff;
	}

	.toolbar-actions button:hover:not(:disabled),
	.apply-btn:hover:not(:disabled) {
		background: var(--button-bg);
		border-color: var(--text-muted);
		transform: translateY(-1px);
	}

	.toolbar-actions button.primary:hover:not(:disabled),
	.apply-btn.primary:hover:not(:disabled) {
		background: var(--accent-hover);
		border-color: var(--accent-primary);
		box-shadow: 0 0 15px var(--accent-glow);
	}

	.toolbar-actions button:active:not(:disabled) {
		transform: translateY(0);
	}

	.toolbar-actions button:disabled {
		cursor: not-allowed;
		opacity: 0.3;
	}

	.toolbar-meta {
		grid-column: 1 / -1;
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(24rem, 1fr);
		gap: 24px;
		align-items: start;
		margin: 0 auto;
		max-width: 1536px;
	}

	.panel {
		display: grid;
		gap: 20px;
		min-width: 0;
		min-height: 0;
		padding: 24px;
		border: 1px solid var(--panel-border);
		border-radius: 12px;
		background: var(--panel-bg);
		backdrop-filter: blur(12px);
		box-shadow: var(--panel-shadow);
	}

	.panel-header {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		justify-content: space-between;
	}

	.panel-note,
	.copy-status {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-muted);
		padding: 4px 10px;
		border-radius: 99px;
		background: var(--button-bg);
		border: 1px solid transparent;
		transition: all 0.2s ease;
	}

	.copy-status.success {
		color: #10b981;
		background: rgba(16, 185, 129, 0.1);
		border-color: rgba(16, 185, 129, 0.2);
	}

	.copy-status.error {
		color: #ef4444;
		background: rgba(239, 68, 68, 0.1);
		border-color: rgba(239, 68, 68, 0.2);
	}

	.grid-frame {
		--grid-max-height: min(60vh, 48rem);
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: clamp(20rem, 60vh, 48rem);
		padding: 24px;
		border: 1px solid var(--panel-border);
		border-radius: 12px;
		background: var(--grid-frame-bg);
		box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.05);
	}

	.pixel-grid {
		display: grid;
		width: min(100%, calc(var(--grid-max-height) * var(--cols, 1) / var(--rows, 1)));
		max-width: 100%;
		gap: 1px;
		padding: 1px;
		border: 1px solid var(--grid-bg);
		border-radius: 4px;
		background: var(--grid-bg);
		aspect-ratio: var(--cols, 1) / var(--rows, 1);
		touch-action: none;
		user-select: none;
	}

	.pixel-grid button {
		aspect-ratio: 1;
		min-width: 0;
		padding: 0;
		border: 0;
		border-radius: 1px;
		background: var(--grid-cell-bg);
		cursor: pointer;
		touch-action: none;
		transition: all 0.15s ease;
	}

	.pixel-grid button:hover {
		background: var(--grid-cell-hover);
		box-shadow: inset 0 0 8px rgba(59, 130, 246, 0.1);
		z-index: 1;
	}

	.pixel-grid button:focus-visible {
		background: var(--grid-cell-hover);
		outline: 2px solid var(--accent-primary);
		outline-offset: -2px;
	}

	.pixel-grid button.hover:not(.active) {
		background: var(--grid-cell-hover);
		box-shadow: inset 0 0 12px var(--accent-glow);
		z-index: 1;
	}

	.pixel-grid button.active {
		background: var(--accent-primary);
		box-shadow: 0 0 12px var(--accent-glow);
	}

	.pixel-grid button.active:hover,
	.pixel-grid button.active:focus-visible {
		background: var(--accent-hover);
		box-shadow: 0 0 20px var(--accent-glow);
	}

	.json-panel {
		grid-template-rows: auto minmax(0, 1fr);
		align-self: start;
		height: min(75vh, 48rem);
		overflow: hidden;
	}

	.json-panel pre {
		box-sizing: border-box;
		min-width: 0;
		min-height: 0;
		width: 100%;
		height: 100%;
		overflow: auto;
		margin: 0;
		padding: 20px;
		border: 1px solid var(--json-border);
		border-radius: 8px;
		background: var(--json-bg);
		white-space: pre;
		overflow-wrap: normal;
		word-break: normal;
		font-family: 'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, monospace;
		font-size: 0.85rem;
		line-height: 1.6;
		color: var(--json-text);
		scrollbar-width: auto;
		scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
	}

	.json-panel pre::-webkit-scrollbar {
		width: 14px;
		height: 14px;
	}

	.json-panel pre::-webkit-scrollbar-track {
		background: var(--scrollbar-track);
		border-radius: 0;
	}

	.json-panel pre::-webkit-scrollbar-thumb {
		background: var(--scrollbar-thumb);
		border: 2px solid var(--scrollbar-track);
		border-radius: 10px;
	}

	.json-panel pre::-webkit-scrollbar-thumb:hover {
		background: var(--text-muted);
	}

	@media (max-width: 920px) {
		.toolbar {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.toolbar-actions {
			grid-column: 1 / -1;
			justify-content: flex-start;
		}

		.workspace {
			grid-template-columns: 1fr;
		}

		.grid-frame {
			--grid-max-height: min(50vh, 32rem);
			min-height: clamp(18rem, 50vh, 32rem);
		}

		.json-panel {
			height: min(28rem, 50vh);
		}
	}

	@media (max-width: 640px) {
		.page-shell {
			padding: 24px 16px;
		}

		.panel-header {
			flex-direction: column;
		}

		.toolbar {
			padding: 16px;
		}
	}
</style>
