import { ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { Platform, request, type TAbstractFile, type TFile } from 'obsidian';
import { ActivityLogModal } from './activity-log';
import type CodeTimePlugin from './main';
import type { Payload, SettingsApp, Stat } from './types';

export class CodeTime {
	private project: string =
		this.plugin.settings.projectOveride !== ''
			? this.plugin.settings.projectOveride
			: this.plugin.app.vault.getName();
	private readonly statusBarItemEl: HTMLElement;
	private readonly activityLogModal: ActivityLogModal;
	private state: 'loading' | 'connected' | 'disconnected' | 'no-token' | 'invalid-token' | 'error' = 'disconnected';
	private codeTimeData: { minutes: number } | null = null;
	private readonly eventThrottleMs = 1_000;
	private readonly lastTrackedAt = new Map<string, number>();

	constructor(private readonly plugin: CodeTimePlugin) {
		this.statusBarItemEl = plugin.addStatusBarItem();
		this.activityLogModal = new ActivityLogModal(plugin.app, plugin);
	}

	async destroy(): Promise<void> {
		this.statusBarItemEl.setText('Codetime: Disconnected');
		this.state = 'disconnected';
		// this.activityLogModal.close();
	}

	async reload(): Promise<void> {
		await this.configure();
	}

	async configure(): Promise<void> {
		await this.destroy();

		this.project =
			this.plugin.settings.projectOveride !== ''
				? this.plugin.settings.projectOveride
				: this.plugin.app.vault.getName();

		// Set the status bar click event once, so it doesn't get re-registered every time
		this.statusBarItemEl.onClickEvent(() => {
			if (this.state === 'invalid-token' || this.state === 'no-token') {
				this.openSettings();
			} else {
				this.activityLogModal.open();
			}
		});
		this.statusBarItemEl.classList.add('codetime-status-bar-item');

		// MARK: Commands
		this.plugin.addCommand({
			id: 'open-codetime-dashboard',
			name: 'Open dashboard in browser',
			callback: () => {
				const url = new URL('/dashboard', this.plugin.settings.apiUrl.toString().replace('api.', ''));
				window.open(url.toString(), '_blank');
			},
		});

		this.state = 'loading';
		this.syncStatusBar();
		this.activityLogModal.appendLine(`Vault: ${this.project}`);
		this.activityLogModal.appendLine(
			`Project Override is ${this.plugin.settings.projectOveride === '' ? 'Off' : 'On'}`,
			'warning',
		);
		this.activityLogModal.appendLine(
			`Filenames are: ${this.plugin.settings.hideFileNames ? 'Hidden' : 'Visible'}`,
			!this.plugin.settings.hideFileNames ? 'warning' : 'success',
		);

		const token = this.getTokenFromSettings();

		if (!token) {
			this.state = 'no-token';
			this.syncStatusBar();
			this.activityLogModal.appendLine('No Token Provided', 'error');
			return;
		}

		this.activityLogModal.appendLine('Token is configured');
		if (!(await this.testToken())) {
			return;
		}

		this.state = 'connected';
		this.syncStatusBar();

		this.activityLogModal.appendLine('Connecting to server');
		await this.fetchCurrentCodeTime();
		this.syncStatusBar();

		await this.startLoop();
		this.listenFor();
	}

	private async startLoop(): Promise<void> {
		this.activityLogModal.appendLine('Starting loop');
		this.plugin.registerInterval(
			window.setInterval(async () => {
				this.activityLogModal.appendLine('Fetching data');
				await this.fetchCurrentCodeTime();
			}, 1000 * 60),
		);
	}

	private listenFor(): void {
		this.plugin.app.workspace.onLayoutReady(() => {
			this.plugin.registerEvent(
				this.plugin.app.workspace.on('file-open', (file) => {
					void this.track('activateFileChanged', file);
				}),
			);

			this.plugin.registerEvent(
				this.plugin.app.workspace.on('editor-change', (_editor, info) => {
					void this.track('editorChanged', info.file);
				}),
			);

			this.plugin.registerEvent(
				this.plugin.app.vault.on('create', (file) => void this.track('fileCreated', file)),
			);
			this.plugin.registerEvent(
				this.plugin.app.vault.on('modify', (file) => {
					void this.track('fileEdited', file);
					// this.track('fileSaved', file); // best available public equivalent
				}),
			);

			const track = this.track.bind(this);
			// Get the current open file
			const file = this.plugin.app.workspace.getActiveFile();
			this.plugin.registerEditorExtension(
				ViewPlugin.fromClass(
					class {
						update(update: ViewUpdate) {
							if (update.selectionSet) {
								void track('selectionChanged', file);
								// update.state.selection.ranges
							}
						}
					},
				),
			);
		});
	}

	private async track(event: string, file: TFile | TAbstractFile | undefined | null) {
		const originalFilePath = file?.path ?? '__no-file__';
		const throttleKey = `${event}:${originalFilePath}`;
		const now = Date.now();
		const lastTime = this.lastTrackedAt.get(throttleKey);
		if (lastTime !== undefined && now - lastTime < this.eventThrottleMs) {
			this.activityLogModal.appendLine(`Throttled: ${event} ${originalFilePath}`);
			return;
		}

		this.lastTrackedAt.set(throttleKey, now);

		const hideFile = this.plugin.settings.hideFileNames;
		const newName = !hideFile ? file?.name : `Untitled-${Date.now()}`;

		const getOs = (): string => {
			switch (true) {
				case Platform.isWin:
					return 'windows';
				case Platform.isLinux:
					return 'linux';
				case Platform.isIosApp:
					return 'ios';
				case Platform.isAndroidApp:
					return 'android';
				case Platform.isMacOS:
					return 'macos';
				default:
					return 'unknown';
			}
		};
		const os = getOs();

		const payload = {
			editor: 'Obsidian',
			language: file && 'extension' in file ? file.extension : 'unknown',
			project: this.project,
			eventTime: Date.now(),
			eventType: event,
			operationType: event === 'activateFileChanged' ? 'read' : 'edit',
			relativeFile: newName,
			absoluteFile: newName,
			platform: os,
			// @ts-expect-error
			// eslint-disable-next-line no-undef, @typescript-eslint/no-unsafe-member-access -- process.arch is only available in desktop apps
			platformArch: Platform.isDesktopApp && 'arch' in process ? (process.arch as unknown) : 'unknown',
			gitOrigin: 'none',
			gitBranch: 'none',
		} as Payload;

		const url = new URL(`/v3/users/event-log`, this.plugin.settings.apiUrl);

		this.activityLogModal.appendLine(
			`Sending event: ${event} - ${file?.name ?? `unknown`}${hideFile ? ' (hidden)' : ''}`,
			'info',
		);

		await request({
			url: url.toString(),
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.getTokenFromSettings()}`,
				'User-Agent': 'obsidian-codetime',
			},
			body: JSON.stringify(payload),
		}).catch((e: Error) => {
			this.activityLogModal.appendLine(`Failed to send event: ${e?.message ?? 'Unknown error'}`, 'error');
			return null;
		});
	}

	private async fetchCurrentCodeTime(): Promise<void> {
		const url = new URL(`/v3/users/self/stats`, this.plugin.settings.apiUrl);
		url.searchParams.set('by', 'workspace');
		url.searchParams.set('unit', 'days');
		url.searchParams.set('limit', '1');
		url.searchParams.set('project', this.project);

		const response = await request({
			url: url.toString(),
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.getTokenFromSettings()}`,
				'User-Agent': 'obsidian-codetime',
			},
		}).catch((e: Error) => {
			this.activityLogModal.appendLine(
				`Failed to fetch CodeTime data: ${e?.message ?? 'Unknown error'}`,
				'error',
			);
			// void this.reload();
			return null;
		});

		if (!response) {
			return;
		}
		const responseJson: Stat = JSON.parse(response) as Stat;
		this.codeTimeData = { minutes: responseJson.data[0]?.duration ?? 0 };
		this.activityLogModal.appendLine(
			`CodeTime data fetched successfully: ${this.convertMinutes(this.codeTimeData.minutes)} (${this.codeTimeData.minutes} minutes)`,
			'success',
		);
		this.syncStatusBar();
	}

	private syncStatusBar(): void {
		let text = '';

		const syncText = (text: string) => {
			this.activityLogModal.appendLine(`State: ${this.state}`);
			this.statusBarItemEl.setText(text);
		};

		if (this.state === 'no-token' || this.state === 'invalid-token') {
			text += 'CodeTime';
			if (this.state === 'invalid-token') {
				text += ': Invalid Token';
			} else {
				text += ': No Token';
			}
			syncText(text);
			return;
		}

		if (this.state === 'error') {
			text += 'CodeTime: Error';
			syncText(text);
			return;
		}

		if (this.state === 'disconnected') {
			text += 'Codetime: Disconnected';
			syncText(text);
			return;
		}

		if (this.state === 'loading') {
			text += 'Codetime: Loading...';
			syncText(text);
			return;
		}

		if (this.state === 'connected') {
			if (!this.codeTimeData) {
				text += 'CodeTime: Fetching...';
			} else {
				text += `${this.project}: ${this.convertMinutes(this.codeTimeData?.minutes ?? 0)}`;
			}
			syncText(text);
			return;
		}
	}

	private async testToken(): Promise<boolean> {
		const url = new URL(`/v3/users/self`, this.plugin.settings.apiUrl);

		this.activityLogModal.appendLine('Testing Authorization');

		const response = await request({
			url: url.toString(),
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.getTokenFromSettings()}`,
				'User-Agent': 'obsidian-codetime',
			},
		}).catch((e: Error) => {
			this.activityLogModal.appendLine(
				`Failed to fetch CodeTime data: ${e?.message ?? 'Unknown error'}`,
				'error',
			);

			this.state = 'invalid-token';
			this.syncStatusBar();

			// void this.reload();
			return false;
		});

		if (!response) {
			this.activityLogModal.appendLine('Authorization failed', 'error');
			return false;
		}

		// this.userData = typeof response === 'string' ? (JSON.parse(response) as UserData) : null;
		this.activityLogModal.appendLine('Authorization successful', 'success');
		return true;
	}

	private convertMinutes(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return `${hours > 0 ? `${hours}h ` : ''}${remainingMinutes}m`;
	}

	private getTokenFromSettings(): string | null {
		return this.plugin.app.secretStorage.getSecret(this.plugin.settings.codeTimeToken);
	}

	private openSettings(): void {
		const app = this.plugin.app as SettingsApp;
		app.setting.open();
		app.setting.openTabById(this.plugin.manifest.id);
	}

	//
}
