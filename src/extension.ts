/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as languageclient from 'vscode-languageclient';
import * as logger from './logger';
import * as path from 'path';
import * as schemacontributor from './schema-contributor'
import * as vscode from 'vscode';
import * as schemaassociationservice from './schema-association-service';

export async function activate(context: vscode.ExtensionContext) {
    logger.log('Extension has been activated!', 'ExtensionActivated'); // TODO: Add extension name.

    const serverOptions: languageclient.ServerOptions = getServerOptions(context);
    const clientOptions: languageclient.LanguageClientOptions = getClientOptions();
    const client = new languageclient.LanguageClient('azure-pipelines', 'Azure Pipelines Support', serverOptions, clientOptions);

    const schemaAssociationService: schemaassociationservice.ISchemaAssociationService = new schemaassociationservice.SchemaAssociationService(context.extensionPath);

    const disposable = client.start();
    context.subscriptions.push(disposable);

    try {
        const initialSchemaAssociations: schemaassociationservice.ISchemaAssociations = schemaAssociationService.getSchemaAssociation();

        await client.onReady();

        logger.log(`${JSON.stringify(initialSchemaAssociations)}`, 'SendInitialSchemaAssociation');
        client.sendNotification(schemaassociationservice.SchemaAssociationNotification.type, initialSchemaAssociations);

        // TODO: Should we get rid of these events and handle other events like Ctrl + Space? See when this event gets fired.
        // It's a hack but we could hijack this event to load latest server content.
        client.onRequest(schemacontributor.CUSTOM_SCHEMA_REQUEST, (resource: any) => {
            logger.log('Custom schema request. Resource: ' + JSON.stringify(resource), 'CustomSchemaRequest');

            // TODO: Can this return the location of the new schema file?
            return schemacontributor.schemaContributor.requestCustomSchema(resource); // TODO: Have a single instance for the extension but dont return a global from this namespace.
        });

        // TODO: Can we get rid of this? Never seems to happen.
        client.onRequest(schemacontributor.CUSTOM_CONTENT_REQUEST, (uri: any) => {
            logger.log('Custom content request.', 'CustomContentRequest');

            return schemacontributor.schemaContributor.requestCustomSchemaContent(uri);
        });
    }
    catch (ex) {
        logger.log(ex, 'ClientOnReady.Error');
    }

    // TODO: Can we get rid of this since it's set in package.json?
    vscode.languages.setLanguageConfiguration('azure-pipelines', { wordPattern: /("(?:[^\\\"]*(?:\\.)?)*"?)|[^\s{}\[\],:]+/ });

    return schemacontributor.schemaContributor;
}

function getServerOptions(context: vscode.ExtensionContext): languageclient.ServerOptions {
    const languageServerPath = context.asAbsolutePath(path.join('node_modules', 'pipelines-language-server', 'out', 'server', 'src', 'server.js'));

    return {
        run : { module: languageServerPath, transport: languageclient.TransportKind.ipc },
        debug: { module: languageServerPath, transport: languageclient.TransportKind.ipc, options: { execArgv: ["--nolazy", "--debug=6009"] } }
    };
}

function getClientOptions(): languageclient.LanguageClientOptions {
    return {
        // Register the server for plain text documents
        documentSelector: [
            { language: 'azure-pipelines', scheme: 'file' },
            { language: 'azure-pipelines', scheme: 'untitled' }
        ],
        synchronize: {
            // Synchronize the setting section 'languageServerExample' to the server
            // TODO: Are these what settings we want to pass through to the server? Would be good to see this happening... And see initializeOptions
            configurationSection: ['yaml', 'http.proxy', 'http.proxyStrictSSL'],
            // Notify the server about file changes to '.clientrc files contain in the workspace
            fileEvents: [
                vscode.workspace.createFileSystemWatcher('**/*.?(e)y?(a)ml'),
                vscode.workspace.createFileSystemWatcher('**/*.json')
            ]
        },
    };
}

// this method is called when your extension is deactivated
export function deactivate() {
}
