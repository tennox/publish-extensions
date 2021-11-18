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
const util = require('util');
const minimist = require('minimist');
const exec = require('./lib/exec');
const getReleases = require('./lib/getReleases');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const dontUpgrade = [
  'file-icons.file-icons', // Git submodule uses unsupported 'git@github.com' URL format
  'DotJoshJohnson.xml', // https://github.com/DotJoshJohnson/vscode-xml/issues/345
  'wingrunr21.vscode-ruby', // This script gets confused and switches to rebornix.Ruby .vsix release (same repo)
  'andreweinand.mock-debug', // https://github.com/open-vsx/publish-extensions/pull/274#issue-562452193
  'DigitalBrainstem.javascript-ejs-support', // https://github.com/Digitalbrainstem/ejs-grammar tagged 1.3.1 but hasn't had a new release tag in over year
  'ecmel.vscode-html-css', // https://github.com/ecmel/vscode-html-css/issues/213
  'ms-vscode.atom-keybindings', // https://github.com/microsoft/vscode-atom-keybindings/releases didn't have a release in 2 years
  'wmaurer.change-case', // https://github.com/wmaurer/vscode-change-case/releases didn't have a release in 6 years
  'jebbs.plantuml', // https://github.com/open-vsx/publish-extensions/pull/290/files#r576063404
  'ms-vscode.hexeditor', // https://github.com/open-vsx/publish-extensions/pull/290#discussion_r576063874
  'mtxr.sqltools', // https://github.com/open-vsx/publish-extensions/pull/290#discussion_r576067381
  'lextudio.restructuredtext', // https://github.com/open-vsx/publish-extensions/pull/317#discussion_r598852958
  'haskell.haskell', // https://github.com/open-vsx/publish-extensions/pull/317#discussion_r598852655
  'miguelsolorio.fluent-icons', // Latest release (0.0.1) is way behind latest tag (0.0.7)
  'eamodio.tsl-problem-matcher', // Latest release (0.0.4) was never published to https://github.com/eamodio/vscode-tsl-problem-matcher/releases
  'vscode-org-mode.org-mode', // https://github.com/vscode-org-mode/vscode-org-mode doesn't have releases or tags, so we've pinned the 1.0.0 commit
  'amazonwebservices.aws-toolkit-vscode', // Latest release in https://github.com/aws/aws-toolkit-vscode/releases is an experimental pre-release, causing this script to fail with "Error: Open VSX already has a more recent version of amazonwebservices.aws-toolkit-vscode: 1.27.0 > 1.27.0-6c4644db65c7"
  "johnsoncodehk.vscode-typescript-vue-plugin", // Failing in update build for missing license https://github.com/open-vsx/publish-extensions/runs/3849684249?check_suite_focus=true
  "johnsoncodehk.volar", // Failing in update build for missing license: https://github.com/open-vsx/publish-extensions/runs/3849684249?check_suite_focus=true
];

(async () => {
  /**
   * @type {{
   *    extensions: {
   *        id: string,
   *        repository: string,
   *        version?: string,
   *        checkout?: string,
   *        location?: string,
   *        prepublish?: string,
   *        extensionFile?: string,
   *        download?: string
   *    }[]
   * }}
   */
  const { extensions } = JSON.parse(await readFile('./extensions.json', 'utf-8'));
  const cliCommandFlags = minimist(process.argv.slice(2));
  const extensionRepositoriesToUpgrade = extensions.filter(e => (!cliCommandFlags.extension || e.id.includes(cliCommandFlags.extension)) && !dontUpgrade.includes(e.id) && !!e.version && !e.download);
  const extensionDownloadsToUpgrade = extensions.filter(e => (!cliCommandFlags.extension || e.id.includes(cliCommandFlags.extension)) && !dontUpgrade.includes(e.id) && /https:\/\/github.com\/.*\/releases\/download\//.test(e.download));
  const extensionsToNotUpgrade = extensions.filter(e => !extensionRepositoriesToUpgrade.concat(extensionDownloadsToUpgrade).map(e => e.id).includes(e.id));
  /** @type {string[]} */
  const failedExtensions = [];
  fs.renameSync('./extensions.json', './extensions.json.old');
  try {
    await writeFile('./extensions.json', JSON.stringify({ extensions: extensionsToNotUpgrade }, null, 2) + '\n', 'utf-8');

    for (const extension of extensionRepositoriesToUpgrade) {
      try {
        let command = 'node add-extension ' + extension.repository + ' --checkout'; // Always try to auto-detect a suitable "checkout" value.
        if (extension.location) {
          command += ' --location=' + JSON.stringify(extension.location);
        }
        if (extension.prepublish) {
          command += ' --prepublish=' + JSON.stringify(extension.prepublish);
        }
        if (extension.extensionFile) {
          command += ' --extensionFile=' + JSON.stringify(extension.extensionFile);
        }
        await exec(command);
      } catch (e) {
        console.error(`${extension.id}: failed to upgrade repository:`, e);

        failedExtensions.push(extension.id);
      }
    }

    for (const extension of extensionDownloadsToUpgrade) {
      try {
        // Fetch the latest GitHub releases to check for updates.
        const repository = extension.download.replace(/\/releases\/download\/.*$/, '');
        const latest = await getReleases.resolveFromRelease(repository, extension.version);
        await exec('node add-extension --download=' + (latest || extension.download));
      } catch (e) {
        console.error(`${extension.id}: failed to upgrade downloads:`, e);
        failedExtensions.push(extension.id);
        try {
          await exec('node add-extension --download=' + (extension.download));
        } catch (e) { }
      }
    }

    // One last pass to clean up results with a few helpful heuristics.
    const { extensions: upgradedExtensions } = JSON.parse(await readFile('./extensions.json', 'utf-8'));
    for (const upgradedExtension of upgradedExtensions) {
      const originalExtension = extensionRepositoriesToUpgrade.find(extension => extension.id === upgradedExtension.id);
      if (!originalExtension) {
          // This extension likely wasn't actually upgraded, leave it as is.
          continue;
      }
      if (upgradedExtension.download) {
          // If we're using (or have switched to) VSIX re-publishing, the following heuristics are unhelpful.
          continue;
      }
      if (upgradedExtension.version && upgradedExtension.version !== originalExtension.version && !upgradedExtension.checkout) {
          // If "version" was bumped, but we're publishing from the default branch, it's probably better to just unpin the version.
          delete upgradedExtension.version;
      }
      if (upgradedExtension.checkout !== originalExtension.checkout && upgradedExtension.version === originalExtension.version) {
          // If "checkout" was modified, but "version" stayed the same, the change of "checkout" is unhelpful. Reset it.
          upgradedExtension.checkout = originalExtension.checkout;
      }
    }
    await writeFile('./extensions.json', JSON.stringify({ extensions: upgradedExtensions }, null, 2) + '\n', 'utf-8');
    if (failedExtensions.length) {
      console.error('failed extensions: ' + failedExtensions);
    }
  } catch (error) {
    console.error(`[FAIL] Could not upgrade extensions.json!`);
    console.error(error);
    process.exitCode = -1;
    fs.renameSync('./extensions.json.old', './extensions.json');
  } finally {
    await fs.promises.writeFile("/tmp/failed-extensions.log", failedExtensions.join(', '), { encoding: 'utf8' });
  }
})();
