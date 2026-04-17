<script lang="ts">
	import { onDestroy } from 'svelte';

	import {
		DEFAULT_GRID_SIZE,
		MAX_GRID_SIZE,
		clearGrid,
		createGrid,
		parseGridDimension,
		paintCell,
		serializeGrid,
		toggleCell,
		type PixelCell,
		type PixelGrid
	} from '$lib/pixel-grid';

	const dimensionHint = `1-${MAX_GRID_SIZE}`;

	let rowInput = $state(String(DEFAULT_GRID_SIZE.rows));
	let colInput = $state(String(DEFAULT_GRID_SIZE.cols));
	let grid = $state<PixelGrid>(createGrid(DEFAULT_GRID_SIZE.rows, DEFAULT_GRID_SIZE.cols));
	let copyFeedback = $state('');
	let copyState = $state<'idle' | 'success' | 'error'>('idle');

	const parsedRows = $derived(parseGridDimension(rowInput));
	const parsedCols = $derived(parseGridDimension(colInput));
	const rowCount = $derived(grid.length);
	const colCount = $derived(grid[0]?.length ?? 0);
	const jsonPreview = $derived(serializeGrid(grid));
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
		const cellKey = getCellKey(row, col);

		if (visitedCells[cellKey]) {
			return;
		}

		grid = paintCell(grid, row, col, paintValue);
		visitedCells[cellKey] = true;
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

	function handleCellKeydown(event: KeyboardEvent, row: number, col: number): void {
		if (event.key !== ' ' && event.key !== 'Enter') {
			return;
		}

		event.preventDefault();
		grid = toggleCell(grid, row, col);
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

<div class="page-shell">
	<header class="page-header">
		<div>
			<p class="eyebrow">픽셀 JSON</p>
			<h1>픽셀을 선택하고 바로 JSON으로 변환하세요.</h1>
		</div>
		<p class="header-copy">
			클릭으로 한 칸씩 토글하고, 드래그로 여러 칸을 한 번에 칠할 수 있습니다.
		</p>
	</header>

	<form class="toolbar" onsubmit={handleSizeSubmit}>
		<label class="field">
			<span>가로</span>
			<input
				type="number"
				min="1"
				max={MAX_GRID_SIZE}
				inputmode="numeric"
				value={colInput}
				oninput={handleColInput}
			/>
		</label>

		<label class="field">
			<span>세로</span>
			<input
				type="number"
				min="1"
				max={MAX_GRID_SIZE}
				inputmode="numeric"
				value={rowInput}
				oninput={handleRowInput}
			/>
		</label>

		<div class="toolbar-actions">
			<button type="submit" class="primary" disabled={!canApplySize}>적용</button>
			<button type="button" onclick={resetGrid}>초기화</button>
			<button type="button" onclick={copyJson}>JSON 복사</button>
		</div>

		<p class="toolbar-meta">{toolbarMessage}</p>
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
				>
					{#each grid as line, rowIndex (rowIndex)}
						{#each line as cell, colIndex (`${rowIndex}:${colIndex}`)}
							<button
								type="button"
								class:active={cell === 1}
								aria-label={`Column ${colIndex + 1}, row ${rowIndex + 1}, ${cell === 1 ? 'selected' : 'empty'}`}
								aria-pressed={cell === 1}
								onpointerdown={(event) => beginPaint(event, rowIndex, colIndex)}
								onpointerenter={(event) => continuePaint(event, rowIndex, colIndex)}
								onkeydown={(event) => handleCellKeydown(event, rowIndex, colIndex)}
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
				<p class={`copy-status ${copyState}`}>{copyFeedback || '실시간으로 반영됩니다.'}</p>
			</div>

			<pre>{jsonPreview}</pre>
		</section>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		background: linear-gradient(180deg, #f4f6ef 0%, #f3ece8 100%);
		color: #13221e;
	}

	:global(button),
	:global(input) {
		font: inherit;
	}

	.page-shell {
		min-height: 100vh;
		padding: 24px;
	}

	.page-header {
		display: grid;
		gap: 12px;
		margin: 0 auto 24px;
		max-width: 1280px;
	}

	.eyebrow,
	.panel-label {
		margin: 0 0 8px;
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		color: #7a4b36;
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	h1 {
		max-width: 14ch;
		font-size: 3.25rem;
		line-height: 1;
	}

	h2 {
		font-size: 1.1rem;
	}

	.header-copy {
		max-width: 56ch;
		font-size: 1rem;
		line-height: 1.6;
		color: #36594f;
	}

	.toolbar {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 9rem)) 1fr;
		gap: 12px;
		align-items: end;
		margin: 0 auto 24px;
		max-width: 1280px;
		padding: 16px;
		border: 1px solid #cfbeae;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.72);
		backdrop-filter: blur(14px);
	}

	.field {
		display: grid;
		gap: 8px;
		font-size: 0.92rem;
		font-weight: 600;
	}

	input {
		min-width: 0;
		padding: 11px 12px;
		border: 1px solid #b59480;
		border-radius: 8px;
		background: #fff;
		color: #13221e;
	}

	.toolbar-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: flex-end;
	}

	.toolbar-actions button {
		padding: 11px 14px;
		border: 1px solid #be9b82;
		border-radius: 8px;
		background: #fdf8f5;
		color: #13221e;
		cursor: pointer;
		transition:
			background-color 120ms ease,
			border-color 120ms ease;
	}

	.toolbar-actions button.primary {
		border-color: #ad5132;
		background: #ad5132;
		color: #fff7f2;
	}

	.toolbar-actions button:hover:not(:disabled),
	.toolbar-actions button:focus-visible:not(:disabled) {
		border-color: #255445;
		background: #f5efe8;
		outline: none;
	}

	.toolbar-actions button.primary:hover:not(:disabled),
	.toolbar-actions button.primary:focus-visible:not(:disabled) {
		border-color: #255445;
		background: #255445;
	}

	.toolbar-actions button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.toolbar-meta {
		grid-column: 1 / -1;
		font-size: 0.92rem;
		color: #5c5446;
	}

	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1.8fr) minmax(19rem, 1fr);
		gap: 24px;
		margin: 0 auto;
		max-width: 1280px;
	}

	.panel {
		display: grid;
		gap: 16px;
		padding: 16px;
		border: 1px solid #d3c8bf;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.82);
		backdrop-filter: blur(14px);
	}

	.panel-header {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		justify-content: space-between;
	}

	.panel-note,
	.copy-status {
		font-size: 0.92rem;
		line-height: 1.4;
		color: #5a6354;
	}

	.copy-status.success {
		color: #1c6b54;
	}

	.copy-status.error {
		color: #8b1e25;
	}

	.grid-frame {
		--grid-max-height: min(55vh, 44rem);
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: clamp(18rem, 55vh, 44rem);
		padding: 16px;
		border: 1px solid #d6d8c8;
		border-radius: 8px;
		background: #fbfaf4;
	}

	.pixel-grid {
		display: grid;
		width: min(100%, calc(var(--grid-max-height) * var(--cols, 1) / var(--rows, 1)));
		max-width: 100%;
		gap: 1px;
		padding: 1px;
		border: 1px solid #d8cfca;
		border-radius: 8px;
		background: #d8cfca;
		aspect-ratio: var(--cols, 1) / var(--rows, 1);
		touch-action: none;
		user-select: none;
	}

	.pixel-grid button {
		aspect-ratio: 1;
		min-width: 0;
		padding: 0;
		border: 0;
		border-radius: 2px;
		background: #ffffff;
		cursor: pointer;
		touch-action: none;
		transition: background-color 120ms ease;
	}

	.pixel-grid button:hover {
		background: #e7cfc0;
	}

	.pixel-grid button:focus-visible {
		background: #e7cfc0;
		outline: 2px solid #ad5132;
		outline-offset: -2px;
	}

	.pixel-grid button.active {
		background: #255445;
	}

	.pixel-grid button.active:hover,
	.pixel-grid button.active:focus-visible {
		background: #b75a3a;
	}

	.json-panel pre {
		overflow: auto;
		margin: 0;
		padding: 16px;
		border: 1px solid #d6d8c8;
		border-radius: 8px;
		background: #fbfaf4;
		font-size: 0.88rem;
		line-height: 1.55;
	}

	@media (max-width: 920px) {
		h1 {
			font-size: 2.8rem;
		}

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
			--grid-max-height: min(48vh, 30rem);
			min-height: clamp(16rem, 48vh, 30rem);
		}
	}

	@media (max-width: 640px) {
		.page-shell {
			padding: 16px;
		}

		.panel-header {
			flex-direction: column;
		}

		.toolbar {
			padding: 14px;
		}

		h1 {
			max-width: 12ch;
			font-size: 2.25rem;
		}
	}
</style>
