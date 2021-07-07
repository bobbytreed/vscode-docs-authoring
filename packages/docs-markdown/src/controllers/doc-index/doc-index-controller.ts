/* eslint-disable import/no-unresolved */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/prefer-for-of */
/* eslint-disable prefer-const */
'use strict';

import { readFileSync, realpathSync } from 'fs';
import {
	insertContentToEditor,
	isMarkdownFileCheck,
	noActiveEditorMessage
} from '../../helper/common';
import { format } from '../../helper/format';
import { sendTelemetryData } from '../../helper/telemetry';
import { AuditEntry } from './audit-entry';
import { AuditRule } from './audit-rule';
import * as vscode from 'vscode';
import { ContentMatch } from './content-match';
import { ContentBlock } from './content-block';
import { OutputChannel } from 'vscode';
import { getMetadataReplacements } from '../metadata-controller';

let commandOption: string;

export function insertDocIndexCommand() {
	try {
		//let path = realpathSync('.');
		//const json = readFileSync('./data/audit-rules.json', 'utf-8');
		//const rules = JSON.parse(json) as AuditRule[];
		AuditRule.LoadRules();
	} catch (error) {
		const stackTrace = !!error.stack ? error.stack : '';
	}
	return [
		{
			command: verify.name,
			callback: verify
		}
	];
}

import { Diagnostic, DiagnosticSeverity } from 'vscode';
let diagnosticCollection: vscode.DiagnosticCollection;

export function docIndexActivate() {
	diagnosticCollection = vscode.languages.createDiagnosticCollection('DocIndex');
}

export function docindexDiagnostics(audits: AuditEntry[]) {
	const editor = vscode.window.activeTextEditor;
	let textDocument = editor.document;

	// The validator creates diagnostics for all uppercase words length 2 and more
	let text = textDocument.getText();
	if (audits.length > 0) {
		audits = audits.sort((a, b) => b.title.length - b.title.length);
		let problems = 0;
		let canonicalFile = vscode.Uri.file(
			vscode.window.activeTextEditor.document.fileName
		).toString();
		let diagnostics = [];
		for (let audit of audits) {
			if (!audit.success) {
				problems++;

				for (let point of audit.indexes) {
					let range = new vscode.Range(
						textDocument.positionAt(point.start),
						textDocument.positionAt(point.end)
					);

					diagnostics.push(
						new vscode.Diagnostic(range, audit.title, vscode.DiagnosticSeverity.Error)
					);
				}
			}
		}

		diagnosticCollection.set(vscode.Uri.parse(canonicalFile), diagnostics);
	}
}

/**
 * Run doc-index verification
 */
export async function verifysilent() {
	verify(false);
}

/**
 * Run doc-index verification
 */
export async function verify(writeOutput: boolean = true) {
	const editor = vscode.window.activeTextEditor;
	let outputChannel: OutputChannel;
	if (writeOutput) {
		const output: OutputChannel = vscode.window.createOutputChannel('Docs: audit rules');
		outputChannel = output;
		output.show();
	}

	if (!editor) {
		noActiveEditorMessage();
		return;
	} else {
		try {
			const entireFile = editor.document.getText();
			const fileName = vscode.window.activeTextEditor.document.fileName;

			if (writeOutput) {
				outputChannel.appendLine(`Verifying file: ${fileName}`);
			}

			const blocks = ContentBlock.splitContentIntoBlocks(fileName, entireFile, false);
			const allBlocks = [];
			for (let block of blocks) {
				allBlocks.push(block);
				block.AllInnerBlocks().forEach((value: ContentBlock) => {
					allBlocks.push(value);
				});
			}

			const metadataString = ContentMatch.getMetadata(entireFile, fileName);
			let metadata = ContentMatch.readMetadata(metadataString);
			if (metadata.keys.length === 0) {
				metadata = ContentMatch.extractMetadata(entireFile);
			}

			const replacementFormats = await getMetadataReplacements(editor);
			for (let replacementFormat of replacementFormats) {
				let type = `${replacementFormat.type}`.replace('.', '_');
				let value = replacementFormat
					.toReplacementString()
					.replace(`${replacementFormat.type}: `, '');
				metadata.set(type, value);
			}

			let topic = metadata.has('ms_topic') ? metadata.get('ms_topic') : '';
			if (topic === '' && writeOutput) {
				outputChannel.appendLine('No MS.Topic detected for MVC guidance');
			} else {
				let theseRules = AuditRule.Rules.filter(e => e.ruleSet === 'MVC');
				theseRules = theseRules.filter(e => e.ruleGroup.toLowerCase() === topic.toLowerCase());
				theseRules = theseRules.filter(e => e.dependsOn === undefined || e.dependsOn == null);
				if (theseRules.length === 0 && writeOutput) {
					outputChannel.appendLine(`No MVC Guidance for ${topic}`);
				} else {
					let theseAudits: AuditEntry[] = [];
					for (let i = 0; i < theseRules.length; i++) {
						let audits = theseRules[i].test(blocks, fileName, metadata, entireFile, blocks);
						audits.forEach(function (value: AuditEntry) {
							theseAudits.push(value);
						});
					}

					theseAudits = theseAudits.sort((a, b) => a.ruleNum - b.ruleNum);
					docindexDiagnostics(theseAudits);
					if (writeOutput) {
						for (let entry of theseAudits) {
							outputChannel.appendLine(`${entry.title}: ${entry.success}`);
						}
					}
				}
			}
		} catch (error) {
			outputChannel.appendLine(error.toString());
			const stackTrace = !!error.stack ? error.stack : '';
			if (stackTrace) {
				outputChannel.appendLine(stackTrace);
			}
		}
	}
}
