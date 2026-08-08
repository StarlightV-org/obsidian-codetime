import { type App, MarkdownRenderer, PluginSettingTab, SecretComponent, type SettingDefinitionItem } from 'obsidian';
import type CodeTimePlugin from './main';

export interface CodeTimePluginSettings {
	/** The SecretStorage ID for the CodeTime token, not the token itself. */
	codeTimeToken: string;
	/** The API URL to use for CodeTime requests. */
	apiUrl: string;
	/** The project override to use for CodeTime requests. */
	projectOveride: string;

	hideFileNames: boolean;
}

export const DEFAULT_SETTINGS: CodeTimePluginSettings = {
	codeTimeToken: '',
	apiUrl: 'https://api.codetime.dev',
	projectOveride: '',
	hideFileNames: true,
};

export class CodeTimeSettingTab extends PluginSettingTab {
	plugin: CodeTimePlugin;

	constructor(app: App, plugin: CodeTimePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private markdownDescription(markdown: string): DocumentFragment {
		const descriptionEl = document.createElement('div');

		void MarkdownRenderer.render(this.app, markdown, descriptionEl, '', this.plugin);

		return createFragment((fragment) => {
			fragment.appendChild(descriptionEl);
		});
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: 'group',
				heading: 'CodeTime',
				extraButtons: [
					(button) => {
						button.setIcon('reset');
						button.onClick(async () => {
							this.plugin.settings = {
								...DEFAULT_SETTINGS,
								codeTimeToken: this.plugin.settings.codeTimeToken,
							};
							await this.plugin.saveSettings();
							this.update();
							this.plugin.codeTime.configure();
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
		];
	}
}
