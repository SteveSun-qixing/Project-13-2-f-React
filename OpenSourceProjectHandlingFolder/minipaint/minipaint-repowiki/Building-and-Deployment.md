# Building and Deployment

> **Relevant source files**
> * [.gitignore](https://github.com/viliusle/miniPaint/blob/6d0b95e5/.gitignore)
> * [dist/bundle.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/dist/bundle.js)
> * [dist/bundle.js.LICENSE.txt](https://github.com/viliusle/miniPaint/blob/6d0b95e5/dist/bundle.js.LICENSE.txt)
> * [dist/bundle.js.map](https://github.com/viliusle/miniPaint/blob/6d0b95e5/dist/bundle.js.map)
> * [images/manifest/144x144.png](https://github.com/viliusle/miniPaint/blob/6d0b95e5/images/manifest/144x144.png)
> * [images/manifest/168x168.png](https://github.com/viliusle/miniPaint/blob/6d0b95e5/images/manifest/168x168.png)
> * [images/manifest/192x192.png](https://github.com/viliusle/miniPaint/blob/6d0b95e5/images/manifest/192x192.png)
> * [images/manifest/48x48.png](https://github.com/viliusle/miniPaint/blob/6d0b95e5/images/manifest/48x48.png)
> * [images/manifest/72x72.png](https://github.com/viliusle/miniPaint/blob/6d0b95e5/images/manifest/72x72.png)
> * [images/manifest/96x96.png](https://github.com/viliusle/miniPaint/blob/6d0b95e5/images/manifest/96x96.png)
> * [package-lock.json](https://github.com/viliusle/miniPaint/blob/6d0b95e5/package-lock.json)
> * [package.json](https://github.com/viliusle/miniPaint/blob/6d0b95e5/package.json)
> * [service-worker.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/service-worker.js)
> * [src/js/modules/image/palette.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/image/palette.js)
> * [src/js/tools/pick_color.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/pick_color.js)
> * [webpack.config.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/webpack.config.js)

This document explains how to build the miniPaint application from source code and deploy it to various environments. It covers the webpack-based build system, development workflow, and deployment options for this web-based image editor.

## Build System Overview

miniPaint uses webpack to bundle JavaScript modules, CSS, and dependencies into a single deployable file. The build process is configured in `webpack.config.js` and controlled through npm scripts defined in `package.json`.

### Build Architecture

```

```

Sources: [webpack.config.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/webpack.config.js)

 [package.json](https://github.com/viliusle/miniPaint/blob/6d0b95e5/package.json)

## Development Environment Setup

### Prerequisites

* Node.js (v12.x or higher)
* npm (usually comes with Node.js)
* Git (for version control)

### Initial Setup

1. Clone the repository: ``` ```
2. Install dependencies: ``` ```
3. Start the development server: ``` ``` This starts webpack-dev-server and opens the application in your default browser.

Sources: [package.json L13-L17](https://github.com/viliusle/miniPaint/blob/6d0b95e5/package.json#L13-L17)

## Build Configuration

### Build Commands

miniPaint provides three npm scripts for different build scenarios:

| Command | Description | Script |
| --- | --- | --- |
| `npm run server` | Starts development server with hot reloading | `webpack serve --mode development --env development --open` |
| `npm run dev` | Creates a development build with source maps | `webpack --mode development` |
| `npm run build` | Creates a minified production build | `webpack --mode production` |

Sources: [package.json L13-L17](https://github.com/viliusle/miniPaint/blob/6d0b95e5/package.json#L13-L17)

### Webpack Configuration

The webpack configuration in `webpack.config.js` defines how miniPaint is built:

1. **Entry Point**: ``` ```
2. **Output Configuration**: ``` ```
3. **Module Rules** for processing different file types: ``` ```
4. **Plugins** for additional functionality: ``` ```

Sources: [webpack.config.js L4-L55](https://github.com/viliusle/miniPaint/blob/6d0b95e5/webpack.config.js#L4-L55)

### Build Dependencies

The build process depends on several packages listed in `package.json`:

* **Babel** for JavaScript transpilation: * `@babel/core` * `@babel/plugin-transform-runtime` * `@babel/preset-env` * `babel-loader`
* **CSS Processing**: * `css-loader` * `style-loader`
* **Webpack Core**: * `webpack` * `webpack-cli` * `webpack-dev-server`

Sources: [package.json L24-L35](https://github.com/viliusle/miniPaint/blob/6d0b95e5/package.json#L24-L35)

## Deployment Process

miniPaint is a client-side application that can be deployed to any web server capable of serving static files.

### Deployment Flow

```

```

Sources: [package.json L13-L17](https://github.com/viliusle/miniPaint/blob/6d0b95e5/package.json#L13-L17)

 [webpack.config.js L8-L11](https://github.com/viliusle/miniPaint/blob/6d0b95e5/webpack.config.js#L8-L11)

### Files Required for Deployment

The following files must be included in the deployment:

| File/Directory | Purpose |
| --- | --- |
| `index.html` | Main HTML file that loads the application |
| `dist/bundle.js` | Bundled JavaScript containing application code |
| `images/` | Directory containing icons and images |

Sources: [webpack.config.js L8-L11](https://github.com/viliusle/miniPaint/blob/6d0b95e5/webpack.config.js#L8-L11)

 [service-worker.js L13-L48](https://github.com/viliusle/miniPaint/blob/6d0b95e5/service-worker.js#L13-L48)

### Deployment Steps

1. Build the application for production: ``` ```
2. Copy these files to your web server's document root: * `index.html` * `dist/bundle.js` * `images/` directory
3. Configure your web server to serve these files as static content.

Sources: [package.json L16](https://github.com/viliusle/miniPaint/blob/6d0b95e5/package.json#L16-L16)

## Deployment Options

### Static Hosting Services

* **GitHub Pages**: * Free hosting directly from your Git repository * Automatically serves files from the repository or a specified branch
* **Netlify/Vercel**: * Continuous deployment from Git * Custom domain support * HTTPS by default

### Self-Hosted Options

* **Traditional Web Servers**: * Apache * Nginx * Microsoft IIS
* **Cloud Storage Services**: * Amazon S3 with static website hosting * Google Cloud Storage * Azure Blob Storage

Sources: [package.json L18-L22](https://github.com/viliusle/miniPaint/blob/6d0b95e5/package.json#L18-L22)

## Advanced Deployment Topics

### Continuous Integration/Continuous Deployment (CI/CD)

For automated builds and deployments, you can set up CI/CD pipelines using:

* GitHub Actions
* GitLab CI
* Travis CI
* CircleCI

A typical workflow would include:

1. Installing dependencies
2. Running the build process
3. Deploying the built files to the hosting platform

### Progressive Web App Support

The repository contains a `service-worker.js` file, but it's currently disabled as noted in the comment:

```

```

This file contains code for caching the application assets for offline use, which could be reactivated if PWA functionality is desired.

Sources: [service-worker.js L1-L3](https://github.com/viliusle/miniPaint/blob/6d0b95e5/service-worker.js#L1-L3)

## Troubleshooting

Common deployment issues include:

1. **Missing Files**: Ensure all required files are included in the deployment.
2. **CORS Issues**: May occur when resources are loaded from different domains.
3. **404 Errors**: Ensure the server is properly configured to serve the application's files.
4. **Cache Problems**: Browser caching might prevent updates from appearing immediately.

For server-specific configuration issues, refer to the documentation for your chosen web server.

Sources: [webpack.config.js L49-L55](https://github.com/viliusle/miniPaint/blob/6d0b95e5/webpack.config.js#L49-L55)