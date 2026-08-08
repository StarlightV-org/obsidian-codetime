import {
	type App,
	PluginSettingTab,
	SecretComponent,
	type SettingDefinitionItem,
} from 'obsidian';
import type CodeTimePlugin from './main';

export interface CodeTimePluginSettings {
	/** The SecretStorage ID for the CodeTime token, not the token itself. */
	codeTimeToken: string;
}

export const DEFAULT_SETTINGS: CodeTimePluginSettings = {
	codeTimeToken: '',
};

export class CodeTimeSettingTab extends PluginSettingTab {
	plugin: CodeTimePlugin;

	constructor(app: App, plugin: CodeTimePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'CodeTime Token',
				desc: 'Select or create the secret that stores your CodeTime token.',
				render: (setting) => {
					setting.addComponent((el) =>
						new SecretComponent(this.app, el)

							.setValue(this.plugin.settings.codeTimeToken)
							.onChange(async (secretId) => {
								this.plugin.settings.codeTimeToken = secretId;
								await this.plugin.saveSettings();
							}),
					);
				},
			},
		];
	}
}
