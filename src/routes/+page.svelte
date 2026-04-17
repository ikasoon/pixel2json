<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fade, slide } from 'svelte/transition';

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
		background: radial-gradient(circle at top, #18181b 0%, #09090b 100%);
		background-attachment: fixed;
		color: #f4f4f5;
	}

	:global(button),
	:global(input) {
		font: inherit;
	}

	.page-shell {
		min-height: 100vh;
		padding: 40px 24px;
	}

	.page-header {
		container-type: inline-size;
		display: grid;
		gap: 12px;
		margin: 0 auto 40px;
		max-width: 1280px;
	}

	.eyebrow,
	.panel-label {
		margin: 0 0 8px;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #3b82f6;
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
		color: #f4f4f5;
	}

	.header-copy {
		max-width: 56ch;
		font-size: 1.1rem;
		line-height: 1.6;
		color: #a1a1aa;
	}

	.toolbar {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 9rem)) 1fr;
		gap: 16px;
		align-items: end;
		margin: 0 auto 24px;
		max-width: 1280px;
		padding: 20px;
		border: 1px solid #27272a;
		border-radius: 12px;
		background: rgba(12, 12, 14, 0.6);
		backdrop-filter: blur(12px);
		box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.2);
	}

	.field {
		display: grid;
		gap: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		color: #a1a1aa;
	}

	input {
		min-width: 0;
		padding: 10px 14px;
		border: 1px solid #27272a;
		border-radius: 8px;
		background: #09090b;
		color: #f4f4f5;
		transition: border-color 0.2s ease;
	}

	input:focus {
		outline: none;
		border-color: #3b82f6;
	}

	.toolbar-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		justify-content: flex-end;
	}

	.toolbar-actions button {
		padding: 10px 18px;
		border: 1px solid #27272a;
		border-radius: 8px;
		background: #18181b;
		color: #f4f4f5;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.toolbar-actions button.primary {
		border-color: #3b82f6;
		background: #3b82f6;
		color: #ffffff;
	}

	.toolbar-actions button:hover:not(:disabled) {
		background: #27272a;
		border-color: #3f3f46;
		transform: translateY(-1px);
	}

	.toolbar-actions button.primary:hover:not(:disabled) {
		background: #2563eb;
		border-color: #3b82f6;
		box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
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
		color: #71717a;
	}

	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1.8fr) minmax(19rem, 1fr);
		gap: 24px;
		align-items: start;
		margin: 0 auto;
		max-width: 1280px;
	}

	.panel {
		display: grid;
		gap: 20px;
		min-width: 0;
		min-height: 0;
		padding: 24px;
		border: 1px solid #27272a;
		border-radius: 12px;
		background: rgba(12, 12, 14, 0.6);
		backdrop-filter: blur(12px);
		box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.2);
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
		color: #71717a;
		padding: 4px 10px;
		border-radius: 99px;
		background: #18181b;
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
		border: 1px solid #18181b;
		border-radius: 12px;
		background: #000000;
		box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.5);
	}

	.pixel-grid {
		display: grid;
		width: min(100%, calc(var(--grid-max-height) * var(--cols, 1) / var(--rows, 1)));
		max-width: 100%;
		gap: 1px;
		padding: 1px;
		border: 1px solid #27272a;
		border-radius: 4px;
		background: #27272a;
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
		background: #09090b;
		cursor: pointer;
		touch-action: none;
		transition: all 0.15s ease;
	}

	.pixel-grid button:hover {
		background: #18181b;
		box-shadow: inset 0 0 8px rgba(59, 130, 246, 0.1);
		z-index: 1;
	}

	.pixel-grid button:focus-visible {
		background: #18181b;
		outline: 2px solid #3b82f6;
		outline-offset: -2px;
	}

	.pixel-grid button.active {
		background: #3b82f6;
		box-shadow: 0 0 12px rgba(59, 130, 246, 0.5);
	}

	.pixel-grid button.active:hover,
	.pixel-grid button.active:focus-visible {
		background: #60a5fa;
		box-shadow: 0 0 20px rgba(59, 130, 246, 0.7);
	}

	.json-panel {
		grid-template-rows: auto minmax(0, 1fr);
		align-self: start;
		height: min(75vh, 48rem);
		overflow: hidden;
	}

	.json-panel pre {
		min-width: 0;
		min-height: 0;
		width: 100%;
		height: 100%;
		overflow: auto;
		margin: 0;
		padding: 20px;
		border: 1px solid #18181b;
		border-radius: 8px;
		background: #000000;
		scrollbar-gutter: stable both-edges;
		white-space: pre;
		overflow-wrap: normal;
		word-break: normal;
		font-family: 'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, monospace;
		font-size: 0.85rem;
		line-height: 1.6;
		color: #3b82f6;
	}

	.json-panel pre::-webkit-scrollbar {
		width: 10px;
		height: 10px;
	}

	.json-panel pre::-webkit-scrollbar-track {
		background: #09090b;
		border-radius: 0;
	}

	.json-panel pre::-webkit-scrollbar-thumb {
		background: #27272a;
		border: 2px solid #09090b;
		border-radius: 10px;
	}

	.json-panel pre::-webkit-scrollbar-thumb:hover {
		background: #3f3f46;
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
