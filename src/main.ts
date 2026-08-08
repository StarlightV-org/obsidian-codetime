import { Plugin } from 'obsidian';
import {
	CodeTimeSettingTab,
	DEFAULT_SETTINGS,
	type CodeTimePluginSettings,
} from './settings';

// Remember to rename these classes and interfaces!

export default class CodeTimePlugin extends Plugin {
	settings!: CodeTimePluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new CodeTimeSettingTab(this.app, this));

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status bar text');

		// // This adds a settings tab so the user can configure various aspects of the plugin

		// // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// // Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(activeDocument, 'click', (_evt: MouseEvent) => {
		// 	new Notice('Click');
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<CodeTimePluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	getToken(): string | null {
		return this.app.secretStorage.getSecret(this.settings.codeTimeToken);
	}
}
