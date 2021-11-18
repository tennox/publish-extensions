# Publish Extensions to Open VSX

[![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-ready--to--code-908a85?logo=gitpod)](https://gitpod.io/#https://github.com/open-vsx/publish-extensions)
[![GitHub Workflow Status](https://github.com/open-vsx/publish-extensions/workflows/Publish%20extensions%20to%20open-vsx.org/badge.svg)](https://github.com/open-vsx/publish-extensions/actions?query=workflow%3A%22Publish+extensions+to+open-vsx.org%22)

A CI script for publishing open-source VS Code extensions to [open-vsx.org](https://open-vsx.org).

## When to Add an Extension?

A goal of Open VSX is to have extension maintainers publish their extensions [according to the documentation](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions). The first step we recommend is to open an issue with the extension owner. If the extension owner is unresponsive for some time, this repo (publish-extensions) can be used **as a temporary workaround** to esure the extension is published to Open VSX.

In the long-run it is better for extension owners to publish their own plugins because:

1. Any future issues (features/bugs) with any published extensions in Open VSX will be directed to their original repo/source-control, and not confused with this repo `publish-extensions`.
1. Extensions published by official authors are shown within the Open VSX marketplace as such. Whereas extensions published via publish-extensions display a warning that the publisher (this repository) is not the official author.
1. Extension owners who publish their own extensions get greater flexibility on the publishing/release process, therefore ensure more accuracy/stability. For instance, in some cases publish-extensions has build steps within this repository, which can cause some uploaded plugin versions to break (e.g. if a plugin build step changes).

⚠️ We accept only extensions with [OSI-approved open source licenses](https://opensource.org/licenses) here. If you want to have an extension with a proprietary or non-approved license, please ask its maintainers to publish it.

## How to Add an Extension?

To automatically publish an extension to Open VSX, simply add it to [`extensions.json`](./extensions.json) with the [options described below](#publishing-options). See [Publishing Options](#publishing-options) for a quick guide.

⚠️ Some extensions require additional build steps, and failing to execute them may lead to a broken extension published to Open VSX. Please check the extension's `scripts` section in the package.json file to find such steps; usually they are named `build` or similar. In case the build steps are included in the [vscode:prepublish](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#prepublish-step) script, they are executed automatically, so it's not necessary to mention them explicitly. Otherwise, please include them in the `prepublish` value, e.g. `"prepublish": "npm run build"`.

Click the button below to start a [Gitpod](https://gitpod.io) workspace where you can run the scripts contained in this repository:

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/open-vsx/publish-extensions)

## Publishing Options

The best way to add an extension here is to open this repository in Gitpod (using the orange button above) and add a new entry to `extensions.json`:

Notes:
- Simply replace `$REPOSITORY_URL` with the extension's actual repository URL

```js
    {
      // Unique Open VSX extension ID in the form "<namespace>.<name>"
      "id": "rebornix.ruby",
      // Repository URL to clone and publish from. If the extension publishes `.vsix` files as release artifacts, this will determine the repo to fetch the releases from.
      "repository": "https://github.com/redhat-developer/vscode-yaml"
    },
```

Here are all the supported values, including optional ones, to build extensions from source:

```js
    {
      // Unique Open VSX extension ID in the form "<namespace>.<name>"
      "id": "rebornix.ruby",
      // Repository URL to clone and publish from. If the extension publishes `.vsix` files as release artifacts, this will determine the repo to fetch the releases from.
      "repository": "https://github.com/rubyide/vscode-ruby",
      // (RECOMMENDED) The Git branch, tag, or commit to check out before publishing (defaults to the repository's default branch)
      "checkout": "v0.27.0",
      // (OPTIONAL) Location of the extension's package.json in the repository (defaults to the repository's root directory)
      "location": "packages/vscode-ruby-client",
      // (OPTIONAL) Extra commands to run just before publishing to Open VSX (i.e. after "yarn/npm install", but before "vscode:prepublish")
      "prepublish": "npm run build",
      // (OPTIONAL) Relative path of the extension vsix file inside the git repo (i.e. when it is built by prepublish commands
      "extensionFile": "dist/js-debug.vsix",
      // (OPTIONAL) Enables publishing of web extensions.
      "web": true
    },
```

## How do extensions get updated?

Every week [a job is ran which checks for updated versions][upgrade-extensions-job]. These changes are reviewed manually, and merged by a maintainer. Once merged, these upgrades are [published nightly][publish-extensions-job]. There should be no reason to raise a PR to update an extension. It could be that the extension is failing to update.

To debug, try running `node upgrade-extensions.js --extension=the-extension-id`, which will try to run the upgrade only for that one extension, providing an error report/reason for why the extension is not updating.

## How are Extensions Published?

Every night at [03:03 UTC](https://github.com/open-vsx/publish-extensions/blob/e70fb554a5c265e53f44605dbd826270b860694b/.github/workflows/publish-extensions.yml#L3-L6), a [GitHub workflow](https://github.com/open-vsx/publish-extensions/blob/e70fb554a5c265e53f44605dbd826270b860694b/.github/workflows/publish-extensions.yml#L9-L21) goes through all entries in [`extensions.json`](./extensions.json), and checks if the specified `"version"` needs to be published to https://open-vsx.org or not.

The [publishing process](https://github.com/open-vsx/publish-extensions/blob/d2df425a84093023f4ee164592f2491c32166297/publish-extensions.js#L58-L87) can be summarized like this:

1. [`git clone "repository"`](https://github.com/open-vsx/publish-extensions/blob/d2df425a84093023f4ee164592f2491c32166297/publish-extensions.js#L61)
2. _([`git checkout "checkout"`](https://github.com/open-vsx/publish-extensions/blob/d2df425a84093023f4ee164592f2491c32166297/publish-extensions.js#L63) if a `"checkout"` value is specified)_
3. [`npm install`](https://github.com/open-vsx/publish-extensions/blob/d2df425a84093023f4ee164592f2491c32166297/publish-extensions.js#L68) (or `yarn install` if a `yarn.lock` file is detected in the repository)
4. _([`"prepublish"`](https://github.com/open-vsx/publish-extensions/blob/d2df425a84093023f4ee164592f2491c32166297/publish-extensions.js#L70))_
5. _([`ovsx create-namespace "publisher"`](https://github.com/open-vsx/publish-extensions/blob/d2df425a84093023f4ee164592f2491c32166297/publish-extensions.js#L75) if it doesn't already exist)_
6. [`ovsx publish`](https://github.com/open-vsx/publish-extensions/blob/d2df425a84093023f4ee164592f2491c32166297/publish-extensions.js#L86) (with `--yarn` if a `yarn.lock` file was detected earlier)

See all `ovsx` CLI options [here](https://github.com/eclipse/openvsx/blob/master/cli/README.md).

[upgrade-extensions-job]: https://github.com/open-vsx/publish-extensions/blob/master/.github/workflows/upgrade-extensions.yml
[publish-extensions-job]: https://github.com/open-vsx/publish-extensions/blob/master/.github/workflows/publish-extensions.yml
