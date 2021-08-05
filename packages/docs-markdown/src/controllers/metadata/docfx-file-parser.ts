import { existsSync, readFileSync, watch } from 'fs';
import { tryFindFile } from '../../helper/common';
import { DocFxMetadata } from './docfx-metadata';

let cachedDocFxJsonFile: DocFxFileInfo | null = null;

export type DocFxFileInfo = {
	readonly fullPath?: string | undefined;
	readonly contents?: DocFxMetadata | undefined;
	readonly lines?: string[] | undefined;
};

export function readDocFxJson(workspaceRootDirectory: string): DocFxFileInfo | null {
	if (cachedDocFxJsonFile !== null) {
		return cachedDocFxJsonFile;
	}

	// Read the DocFX.json file, search for metadata defaults.
	const docFxJson = tryFindFile(workspaceRootDirectory, 'docfx.json');
	if (!!docFxJson && existsSync(docFxJson)) {
		const jsonBuffer = readFileSync(docFxJson);
		const json = jsonBuffer.toString();
		cachedDocFxJsonFile = {
			fullPath: docFxJson,
			contents: JSON.parse(json) as DocFxMetadata,
			lines: json.split(/\r\n|\n\r|\n|\r/)
		};

		watch(docFxJson, (event, fileName) => {
			if (fileName && event === 'change') {
				// If the file changes, clear out our cache - and reload it next time it's needed.
				cachedDocFxJsonFile = null;
			}
		});

		return cachedDocFxJsonFile;
	}

	return null;
}
