import type { App } from 'obsidian';

export type SettingsApp = App & {
	setting: {
		open(): void;
		openTabById(id: string): void;
	};
};

export interface UserData {
	id: number;
	email: string;
	username: string;
	avatar: string;
	githubId: number;
	bio: string;
	googleId: string;
	plan: string;
	timezone: string;
	uploadToken: string;
	planExpiresAt: string;
	planStatus: string;
	createdAt: string;
	updatedAt: string;
}

export interface Payload {
	project: string;
	language: string;
	relativeFile: string;
	absoluteFile: string;
	editor: string;
	platform: string;
	eventTime: number;
	eventType: string;
	platformArch: string;
	gitOrigin: string;
	gitBranch: string;
	operationType: string;
}
