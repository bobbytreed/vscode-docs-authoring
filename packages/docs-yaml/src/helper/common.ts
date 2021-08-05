'use-strict';

import { Uri, window, workspace } from 'vscode';
import { reporter } from '../helper/telemetry';
export const output = window.createOutputChannel('docs-yaml');

/**
 * Return repo name
 * @param Uri
 */
export function getRepoName(workspacePath: Uri) {
	const repo = workspace.getWorkspaceFolder(workspacePath);
	if (repo) {
		const repoName = repo.name;
		return repoName;
	}
}

export function sendTelemetryData(telemetryCommand: string, commandOption: string) {
	const editor = window.activeTextEditor;
	const workspaceUri = editor.document.uri;
	const activeRepo = getRepoName(workspaceUri);
	const telemetryProperties = activeRepo
		? { command_option: commandOption, repo_name: activeRepo }
		: { command_option: commandOption, repo_name: '' };

	const config = workspace.getConfiguration('docsYaml');
	const enableTelemetry = config.get<boolean>('telemetry.enableTelemetry');

	if (enableTelemetry) {
		reporter.sendTelemetryEvent(telemetryCommand, telemetryProperties);
	}
}
