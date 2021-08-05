/* eslint-disable @typescript-eslint/no-non-null-assertion */
'use-strict';

import yaml = require('js-yaml');
import { existsSync, readFileSync } from 'fs';
import { sync } from 'glob';
import { platform } from 'os';
import { extname, join, parse, sep, resolve } from 'path';
import {
	DocumentLink,
	Extension,
	extensions,
	Position,
	Range,
	Selection,
	TextDocument,
	TextEditor,
	Uri,
	window,
	workspace
} from 'vscode';
import { output } from './output';

export const ignoreFiles = ['.git', '.github', '.vscode', '.vs', 'node_module'];

export function tryFindFile(rootPath: string, fileName: string) {
	let result: {
		path?: string;
		error?: any | unknown;
	};

	try {
		const fullPath = resolve(rootPath, fileName);
		const exists = existsSync(fullPath);
		if (exists) {
			result = { path: fullPath };
		} else {
			const files = sync(`**/${fileName}`, {
				cwd: rootPath
			});

			if (files && files.length === 1) {
				result = { path: join(rootPath, files[0]) };
			}
		}
	} catch (error) {
		result = { error };
	}

	if (!result?.path) {
		result = traverseDirectoryToFile(rootPath, fileName);
	}

	if (result?.error) {
		postWarning(
			`Unable to find a file named "${fileName}", recursively at root "${rootPath}".\n${result?.error}`
		);
	}

	return result?.path;
}

function traverseDirectoryToFile(
	rootPath: string,
	fileName: string
): {
	path?: string;
	error?: any | unknown;
} {
	let error: any | unknown;
	try {
		const getParent = (dir: string) => {
			if (dir) {
				const segments = dir.split(sep);
				if (segments.length > 1) {
					segments.pop();
					return segments.join(sep);
				}
			}
			return dir;
		};
		const isRoot = (dir: string) => parse(dir).root === dir;

		let currentDirectory = rootPath;
		let filePath: string;
		while (!filePath) {
			const fullPath = resolve(currentDirectory, fileName);
			const exists = existsSync(fullPath);
			if (exists) {
				filePath = fullPath;
			} else {
				currentDirectory = getParent(currentDirectory);
				if (isRoot(currentDirectory)) {
					break;
				}
			}
		}
		return { path: filePath };
	} catch (e) {
		error = e;
	}

	return { error };
}

/**
 * Provide current os platform
 */
export function getOSPlatform(this: any) {
	if (this.osPlatform == null) {
		this.osPlatform = platform();
		this.osPlatform = this.osPlatform;
	}
	return this.osPlatform;
}

/**
 * Create a posted warning message and applies the message to the log
 * @param {string} message - the message to post to the editor as an warning.
 */
export function postWarning(message: string) {
	window.showWarningMessage(message);
}

/**
 * Create a posted information message and applies the message to the log
 * @param {string} message - the message to post to the editor as an information.
 */
export function postInformation(message: string) {
	window.showInformationMessage(message);
}

/**
 * Create a posted information message and applies the message to the log
 * @param {string} message - the message to post to the editor as an information.
 */
export function postError(message: string) {
	window.showErrorMessage(message);
}

/**
 * Checks that there is a document open, and the document has selected text.
 * Displays warning to users if error is caught.
 * @param {vscode.TextEditor} editor - the activeTextEditor in the vscode window
 * @param {boolean} testSelection - test to see if the selection includes text in addition to testing a editor is open.
 * @param {string} senderName - the name of the command running the test.
 */
export function isValidEditor(editor: TextEditor, testSelection: boolean, senderName: string) {
	if (editor === undefined) {
		output.appendLine('Please open a document to apply ' + senderName + ' to.');
		return false;
	}

	if (testSelection && editor.selection.isEmpty) {
		if (
			senderName === 'format bold' ||
			senderName === 'format italic' ||
			senderName === 'format code'
		) {
			output.appendLine(
				'VS Code active editor has valid configuration to apply ' + senderName + ' to.'
			);
			return true;
		}
		output.appendLine('No text selected, cannot apply ' + senderName + '.');
		return false;
	}

	output.appendLine(
		'VS Code active editor has valid configuration to apply ' + senderName + ' to.'
	);
	return true;
}

export function noActiveEditorMessage() {
	postWarning('No active editor. Abandoning command.');
}

export function unsupportedFileMessage(languageId: string) {
	postWarning(`Command is not support for "${languageId}". Abandoning command.`);
}

export function hasValidWorkSpaceRootPath(senderName: string) {
	let folderPath: string = '';

	if (folderPath == null) {
		postWarning(
			'The ' +
				senderName +
				' command requires an active workspace. Please open VS Code from the root of your clone to continue.'
		);
		return false;
	}

	if (workspace.workspaceFolders) {
		folderPath = workspace.workspaceFolders[0].uri.fsPath;
	}

	return true;
}

/**
 * Inserts or Replaces text at the current selection in the editor.
 * If overwrite is set the content will replace current selection.
 * @param {vscode.TextEditor} editor - the active editor in vs code.
 * @param {string} senderName - the name of the function that is calling this function
 * which is used to provide traceability in logging.
 * @param {string} string - the content to insert.
 * @param {boolean} overwrite - if true replaces current selection.
 * @param {vscode.Range} selection - if null uses the current selection for the insert or update.
 * If provided will insert or update at the given range.
 */

export async function insertContentToEditor(
	editor: TextEditor,
	content: string,
	overwrite: boolean = false,
	selection: Range = null!
) {
	if (selection == null) {
		selection = editor.selection;
	}

	try {
		if (overwrite) {
			await editor.edit(update => {
				update.replace(selection, content);
			});
		} else {
			// Gets the cursor position
			const position = editor.selection.active;

			await editor.edit(selected => {
				selected.insert(position, content);
			});
		}
	} catch (error) {
		output.appendLine('Could not write content to active editor window: ' + error);
	}
}

/**
 * Set the cursor to a new position, based on X and Y coordinates.
 * @param {vscode.TextEditor} editor -
 * @param {number} line -
 * @param {number} character -
 */
export function setCursorPosition(editor: TextEditor, line: number, character: number) {
	const cursorPosition = editor.selection.active;
	const newPosition = cursorPosition.with(line, character);
	const newSelection = new Selection(newPosition, newPosition);
	editor.selection = newSelection;
}

export function setSelectorPosition(
	editor: TextEditor,
	fromLine: number,
	fromCharacter: number,
	toLine: number,
	toCharacter: number
) {
	const fromPosition = new Position(fromLine, fromCharacter);
	const toPosition = new Position(toLine, toCharacter);
	editor.selection = new Selection(fromPosition, toPosition);
}

/**
 *  Function does trim from the right on the the string. It removes specified characters.
 *  @param {string} str - string to trim.
 *  @param {string} chr - searched characters to trim.
 */
export function rtrim(str: string, chr: string) {
	const rgxtrim = !chr ? new RegExp('\\s+$') : new RegExp(chr + '+$');
	return str.replace(rgxtrim, '');
}

/**
 * Checks to see if the active file is markdown.
 * Commands should only run on markdown files.
 * @param {vscode.TextEditor} editor - the active editor in vs code.
 */
export function isMarkdownFileCheck(editor: TextEditor, languageId: boolean) {
	if (editor.document.languageId !== 'markdown') {
		if (editor.document.languageId !== 'yaml') {
			postInformation('The docs-markdown extension only works on Markdown files.');
		}
		return false;
	} else {
		return true;
	}
}

export function isMarkdownFileCheckWithoutNotification(editor: TextEditor) {
	if (editor.document.languageId !== 'markdown') {
		return false;
	} else {
		return true;
	}
}

export function isMarkdownYamlFileCheckWithoutNotification(editor: TextEditor) {
	if (editor.document.languageId === 'markdown' || editor.document.languageId === 'yaml') {
		return true;
	} else {
		return false;
	}
}

export function isValidFileCheck(editor: TextEditor, languageIds: string[]) {
	return languageIds.some(id => editor.document.languageId === id);
}

/**
 * Telemetry or Trace Log Type
 */
export enum LogType {
	Telemetry,
	Trace
}

/**
 * Create timestamp
 */
export function generateTimestamp() {
	const date = new Date(Date.now());
	return {
		msDateValue: date.toLocaleDateString('en-us'),
		msTimeValue: date.toLocaleTimeString([], { hour12: false })
	};
}

/**
 * Check for install extensions
 */
export function checkExtensionInstalled(extensionName: string, notInstalledMessage?: string) {
	const extension = getInstalledExtension(extensionName, notInstalledMessage);
	return !!extension;
}

/**
 * Check for active extensions
 */
export function checkExtension(extensionName: string, notInstalledMessage?: string) {
	const extension = getInstalledExtension(extensionName, notInstalledMessage);
	return !!extension && extension.isActive;
}

function getInstalledExtension(
	extensionName: string,
	notInstalledMessage?: string
): Extension<any> {
	const extensionValue = extensions.getExtension(extensionName);
	if (!extensionValue) {
		if (notInstalledMessage) {
			output.appendLine(notInstalledMessage);
		}
		return undefined;
	}
	return extensionValue;
}

/**
 * Output message with timestamp
 * @param message
 */
export function showStatusMessage(message: string) {
	const { msTimeValue } = generateTimestamp();
	output.appendLine(`[${msTimeValue}] - ${message}`);
}

export function detectFileExtension(filePath: string) {
	const fileExtension = extname(filePath);
	return fileExtension;
}

/**
 * Create a posted error message and applies the message to the log
 * @param {string} message - the message to post to the editor as an error.
 */
export async function showWarningMessage(message: string) {
	await window.showWarningMessage(message);
}

export function matchAll(pattern: RegExp, text: string): RegExpMatchArray[] {
	const out: RegExpMatchArray[] = [];
	pattern.lastIndex = 0;
	let match: RegExpMatchArray | null = pattern.exec(text);
	while (match) {
		if (match) {
			// This is necessary to avoid infinite loops with zero-width matches
			if (match.index === pattern.lastIndex) {
				pattern.lastIndex++;
			}

			out.push(match);
		}

		match = pattern.exec(text);
	}
	return out;
}

export function extractDocumentLink(
	document: TextDocument,
	link: string,
	matchIndex: number | undefined
): DocumentLink | undefined {
	const offset = (matchIndex || 0) + 8;
	const linkStart = document.positionAt(offset);
	const linkEnd = document.positionAt(offset + link.length);
	const text = document.getText(new Range(linkStart, linkEnd));
	try {
		const httpMatch = text.match(/^(http|https):\/\//);
		if (httpMatch) {
			const documentLink = new DocumentLink(new Range(linkStart, linkEnd), Uri.parse(link));
			return documentLink;
		} else {
			const filePath = document.fileName.split('\\').slice(0, -1).join('\\');

			const documentLink = new DocumentLink(
				new Range(linkStart, linkEnd),
				Uri.file(resolve(filePath, link))
			);
			return documentLink;
		}
	} catch (e) {
		return undefined;
	}
}

export const naturalLanguageCompare = (a: string, b: string) => {
	return !!a && !!b ? a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) : 0;
};

export function escapeRegExp(content: string) {
	return content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function splice(insertAsPosition: number, content: string, insertStr: string) {
	return content.slice(0, insertAsPosition) + insertStr + content.slice(insertAsPosition);
}

export function toShortDate(date: Date) {
	const year = date.getFullYear();
	const month = (1 + date.getMonth()).toString();
	const monthStr = month.length > 1 ? month : `0${month}`;
	const day = date.getDate().toString();
	const dayStr = day.length > 1 ? day : `0${day}`;

	return `${monthStr}/${dayStr}/${year}`;
}

export function findLineNumberOfPattern(editor: TextEditor, pattern: string) {
	const article = editor.document;
	let found = -1;

	for (let line = 0; line < article.lineCount; line++) {
		const text = article.lineAt(line).text;
		const match = text.match(pattern);
		if (match !== null && match.index !== undefined) {
			found = line;
			return found;
		}
	}
	return found;
}

export function isNullOrWhiteSpace(str: string) {
	return !str || str.length === 0 || /^\s*$/.test(str);
}

export function getYmlTitle(filePath: string) {
	try {
		const doc = yaml.load(readFileSync(filePath, 'utf8'));
		return doc.title;
	} catch (error) {
		output.appendLine(error);
	}
}
