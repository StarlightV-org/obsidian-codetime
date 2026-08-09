import { type App, Modal } from 'obsidian';
import type CodeTimePlugin from './main';

export type ActivityLogLevel = 'info' | 'success' | 'warning' | 'error';

interface ActivityLogEntry {
	message: string;
	level: ActivityLogLevel;
	timestamp: Date;
}

type ActivityLogFilter = ActivityLogLevel | 'all';

export class ActivityLogModal extends Modal {
	plugin: CodeTimePlugin;
	private readonly entries: ActivityLogEntry[] = [];
	private filter: ActivityLogFilter = 'all';
	private searchTerm = '';
	private logEl?: HTMLDivElement;
	private reloadButton?: HTMLButtonElement;

	constructor(app: App, plugin: CodeTimePlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		this.setTitle('Activity log');
		this.modalEl.addClass('codetime-activity-log-modal');
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
		this.logEl = undefined;
	}

	/** Add a line to the log. It is retained when the modal is closed. */
	appendLine(message: string, level: ActivityLogLevel = 'info', timestamp = new Date()): void {
		this.entries.push({ message, level, timestamp });
		this.renderLog();
	}

	clear(): void {
		this.entries.length = 0;
		this.renderLog();
	}

	getLogText(): string {
		return this.entries.map((entry) => this.formatEntry(entry)).join('\n');
	}

	private render(): void {
		this.contentEl.empty();

		const toolbar = this.contentEl.createDiv({
			cls: 'codetime-log-toolbar',
		});
		const filter = toolbar.createEl('select', {
			cls: 'codetime-log-filter',
			attr: { 'aria-label': 'Filter log entries' },
		});
		for (const option of [
			['all', 'All'],
			['info', 'Info'],
			['success', 'Success'],
			['warning', 'Warning'],
			['error', 'Error'],
		] as const) {
			filter.createEl('option', {
				value: option[0],
				text: option[1],
			});
		}
		filter.value = this.filter;
		filter.addEventListener('change', () => {
			this.filter = filter.value as ActivityLogFilter;
			this.renderLog();
		});

		const search = toolbar.createEl('input', {
			cls: 'codetime-log-search',
			attr: {
				type: 'search',
				placeholder: 'Filter...',
				'aria-label': 'Search log entries',
			},
		});
		search.value = this.searchTerm;
		search.addEventListener('input', () => {
			this.searchTerm = search.value;
			this.renderLog();
		});

		this.logEl = this.contentEl.createDiv({
			cls: 'codetime-log-output',
			attr: { role: 'log', 'aria-live': 'polite' },
		});

		const footer = this.contentEl.createDiv({
			cls: 'codetime-log-footer',
		});

		const doneButton = footer.createEl('button', { text: 'Done' });
		doneButton.addEventListener('click', () => this.close());

		this.reloadButton = footer.createEl('button', { text: 'Reload' });
		this.reloadButton.addEventListener('click', () => {
			void this.plugin.codeTime.reload();
		});

		this.renderLog();
	}

	private renderLog(): void {
		if (!this.logEl) return;

		this.logEl.empty();
		const searchTerm = this.searchTerm.trim().toLowerCase();
		const visibleEntries = this.entries.filter((entry) => {
			const matchesLevel = this.filter === 'all' || entry.level === this.filter;
			const matchesSearch = !searchTerm || entry.message.toLowerCase().includes(searchTerm);
			return matchesLevel && matchesSearch;
		});

		for (const entry of visibleEntries) {
			const line = this.logEl.createDiv({
				cls: ['codetime-log-line', `is-${entry.level}`],
			});
			line.setText(this.formatEntry(entry));
		}

		this.logEl.scrollTop = this.logEl.scrollHeight;
	}

	private formatEntry(entry: ActivityLogEntry): string {
		const date = entry.timestamp;

		const timestamp = `${date.getHours()}:${this.pad(date.getMinutes())}:${this.pad(date.getSeconds())}`;

		return `${timestamp} - ${entry.message}`;
	}

	private pad(value: number): string {
		return value.toString().padStart(2, '0');
	}
}
