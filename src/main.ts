import { Plugin } from 'obsidian';
import { CodeTime } from './codetime';
import { type CodeTimePluginSettings, CodeTimeSettingTab, DEFAULT_SETTINGS } from './settings';

export default class CodeTimePlugin extends Plugin {
	settings!: CodeTimePluginSettings;
	codeTime: CodeTime = null as unknown as CodeTime;

	async onload() {
		await this.loadSettings();
		this.codeTime = new CodeTime(this);
		this.addSettingTab(new CodeTimeSettingTab(this.app, this));
		await this.codeTime.configure();
	}

	onunload() {
		void this.codeTime.destroy();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<CodeTimePluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
