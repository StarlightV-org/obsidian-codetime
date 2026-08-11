import {
	type App,
	Component,
	MarkdownRenderer,
	PluginSettingTab,
	SecretComponent,
	type SettingDefinitionItem,
} from 'obsidian';
import type CodeTimePlugin from './main';

export interface CodeTimePluginSettings {
	/** The SecretStorage ID for the CodeTime token, not the token itself. */
	codeTimeToken: string;
	/** The API URL to use for CodeTime requests. */
	apiUrl: string;
	/** The project override to use for CodeTime requests. */
	projectOveride: string;
	/** Whether to hide file names in the activity log. */
	hideFileNames: boolean;
	/** The throttle telemetry setting. in seconds */
	throttleTelemetry: number;
	/** The update interval setting. in minutes */
	updateInterval: number;
}

export const DEFAULT_SETTINGS: CodeTimePluginSettings = {
	codeTimeToken: '',
	apiUrl: 'https://api.codetime.dev',
	projectOveride: '',
	hideFileNames: true,
	throttleTelemetry: 1,
	updateInterval: 1,
};

export class CodeTimeSettingTab extends PluginSettingTab {
	plugin: CodeTimePlugin;
	private markdownComponents: Component[] = [];

	constructor(app: App, plugin: CodeTimePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private markdownDescription(markdown: string): DocumentFragment {
		const descriptionEl = createDiv();
		const component = new Component();
		component.load();
		this.markdownComponents.push(component);

		void MarkdownRenderer.render(this.app, markdown, descriptionEl, '', component);

		return createFragment((fragment) => {
			fragment.appendChild(descriptionEl);
		});
	}

	private unloadMarkdownComponents(): void {
		for (const component of this.markdownComponents) {
			component.unload();
		}
		this.markdownComponents = [];
	}

	override hide(): void {
		this.unloadMarkdownComponents();
		super.hide();
	}

	override async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === 'apiUrl' && typeof value === 'string') {
			this.plugin.settings.apiUrl = value;
		}

		if (key === 'projectOveride' && typeof value === 'string') {
			this.plugin.settings.projectOveride = value;
		}

		if (key === 'hideFileNames' && typeof value === 'boolean') {
			this.plugin.settings.hideFileNames = value;
		}

		if (key === 'throttleTelemetry' && typeof value === 'number') {
			this.plugin.settings.throttleTelemetry = value;
		}

		if (key === 'updateInterval' && typeof value === 'number') {
			this.plugin.settings.updateInterval = value;
		}

		await this.plugin.saveSettings();
		await this.plugin.codeTime.configure();
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		this.unloadMarkdownComponents();

		return [
			{
				type: 'group',
				heading: 'CodeTime',
				extraButtons: [
					async (button) => {
						button.setIcon('reset');
						button.onClick(async () => {
							this.plugin.settings = {
								...DEFAULT_SETTINGS,
								codeTimeToken: this.plugin.settings.codeTimeToken,
							};
							await this.plugin.saveSettings();
							this.update();
							await this.plugin.codeTime.configure();
						});
						button.setTooltip('Reset to default');
					},
				],

				items: [
					{
						name: 'CodeTime Token',
						desc: this.markdownDescription(
							'Select or create the secret that stores your CodeTime token. ' +
								'\n[Open CodeTime settings](https://codetime.dev/dashboard/settings).',
						),
						// desc: 'Select or create the secret that stores your CodeTime token. Visit (codetime.dev)[https://codetime.dev/dashboard/settings]',
						render: (setting) => {
							setting.addComponent((el) =>
								new SecretComponent(this.app, el)
									.setValue(this.plugin.settings.codeTimeToken)
									.onChange(async (secretId) => {
										this.plugin.settings.codeTimeToken = secretId;
										await this.plugin.saveSettings();
										await this.plugin.codeTime.configure();
									}),
							);
						},
					},
					{
						name: 'Server URL',
						desc: 'The URL of the CodeTime server to use.',
						control: {
							type: 'text',
							key: 'apiUrl',
							defaultValue: 'https://api.codetime.dev',
							validate: (url) => {
								if (!url) return 'URL is required';
								if (!url.startsWith('http')) return 'URL must start with http or https';
								return undefined;
							},
						},
					},
					{
						name: 'Project Override',
						desc: 'The URL of the CodeTime server to use.',
						control: {
							type: 'text',
							key: 'projectOveride',
							defaultValue: '',
						},
					},
				],
			},
			{
				type: 'group',
				heading: 'Privacy',
				items: [
					{
						name: 'Hide File Names',
						desc: 'Hide file names in telemetry data.',
						control: {
							type: 'toggle',
							key: 'hideFileNames',
							defaultValue: true,
						},
					},
				],
			},
			{
				type: 'group',
				heading: 'Performance',
				items: [
					{
						name: 'Throttle Telemetry',
						desc: 'Throttle telemetry data to reduce network usage. (in seconds)',
						control: { type: 'slider', key: 'throttleTelemetry', min: 1, max: 10, step: 1 },
					},
					{
						name: 'Update Interval',
						desc: 'The interval at which the current telemetry data is fetched from the server. (in minutes)',
						control: { type: 'slider', key: 'updateInterval', min: 1, max: 10, step: 1 },
					},
				],
			},
		];
	}
}
