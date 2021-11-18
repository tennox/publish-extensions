/********************************************************************************
 * Copyright (c) 2020 TypeFox and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

// @ts-check
const fs = require('fs');
const ovsx = require('ovsx');
const path = require('path');
const semver = require('semver');
const exec = require('./lib/exec');

(async () => {
    /**
     * @type {{extension: import('./types').Extension, context: import('./types').PublishContext}}
     */
    const { extension, context } = JSON.parse(process.argv[2]);
    console.log(`\nProcessing extension: ${JSON.stringify({ extension, context }, undefined, 2)}`);
    try {
        const { id } = extension;
        const [namespace] = id.split('.');

        // Check if the requested version is greater than the one on Open VSX.
        if (context.ovsxVersion) {
            if (semver.gt(context.ovsxVersion, context.version)) {
                throw new Error(`extensions.json is out-of-date: Open VSX version ${context.ovsxVersion} is already greater than specified version ${context.version}`);
            }
            if (semver.eq(context.ovsxVersion, context.version)) {
                console.log(`[SKIPPED] Requested version ${context.version} is already published on Open VSX`);
                return;
            }
        }

        console.log(`Attempting to publish ${id} to Open VSX`);

        // Create a public Open VSX namespace if needed.
        try {
            await ovsx.createNamespace({ name: namespace });
        } catch (error) {
            console.log(`Creating Open VSX namespace failed -- assuming that it already exists`);
            console.log(error);
        }

        if (context.file) {
            await ovsx.publish({ extensionFile: context.file });
        } else if (context.ref) {
            // Clone and set up the repository.
            await exec(`git clone --recurse-submodules ${extension.repository} /tmp/repository`);
            if (context.ref) {
                await exec(`git checkout ${context.ref}`, { cwd: '/tmp/repository' });
            }
            let yarn = await new Promise(resolve => {
                fs.access(path.join('/tmp/repository', 'yarn.lock'), error => resolve(!error));
            });
            await exec(`${yarn ? 'yarn' : 'npm'} install`, { cwd: '/tmp/repository' });
            if (extension.prepublish) {
                await exec(extension.prepublish, { cwd: '/tmp/repository' })
            }

            // Publish the extension.
            /** @type {import('ovsx').PublishOptions} */
            let options;
            if (extension.extensionFile) {
                if (extension.location) {
                    console.warn('[WARN] Ignoring `location` property because `extensionFile` was given.')
                }
                options = { extensionFile: path.join('/tmp/repository', extension.extensionFile) };
            } else {
                options = { packagePath: path.join('/tmp/repository', extension.location || '.') };
            }
            if (yarn) {
                options.yarn = true;
            }
            await ovsx.publish(options);
        }
        console.log(`[OK] Successfully published ${id} to Open VSX!`)
    } catch (error) {
        if (error && String(error).indexOf('is already published.') !== -1) {
            console.log(`Could not process extension -- assuming that it already exists`);
            console.log(error);
        } else {
            console.error(`[FAIL] Could not process extension: ${JSON.stringify({ extension, context }, null, 2)}`);
            console.error(error);
            process.exitCode = -1;
        }
    }
})();
