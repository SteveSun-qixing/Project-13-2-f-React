# Media Tool

> **Relevant source files**
> * [src/js/modules/image/resize.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/modules/image/resize.js)
> * [src/js/tools/media.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/media.js)

## Purpose and Scope

The Media Tool in miniPaint provides functionality for searching and importing images from the Pixabay image service directly into the editor. It allows users to find relevant images using keyword searches and import them as new layers, providing a streamlined workflow for adding external media to projects.

This document covers the implementation, behavior, and usage of the Media Tool. For information about importing files from your local system, see [File Operations](/viliusle/miniPaint/5.1-file-operations).

## Architecture Overview

The Media Tool integrates with several core components of miniPaint to provide its functionality.

```

```

Sources: [src/js/tools/media.js L9-L164](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/media.js#L9-L164)

## Implementation Details

### Class Structure

The Media Tool is implemented as `Media_class` which extends `Base_tools_class`, following the standard pattern for tools in miniPaint.

```

```

Sources: [src/js/tools/media.js L9-L32](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/media.js#L9-L32)

### Key Components

The Media Tool relies on several components:

1. **File_open_class**: Handles importing images from URLs
2. **Tools_settings_class**: Provides access to user settings like safe search
3. **Dialog_class**: Used to create the search dialog interface
4. **alertify**: Used for showing error messages

During initialization, the Media Tool sets up the following properties:

| Property | Type | Purpose |
| --- | --- | --- |
| `name` | String | Identifies the tool as 'media' |
| `cache` | Array | Stores previous search results to avoid redundant API calls |
| `page` | Number | Tracks the current page of search results |
| `per_page` | Number | Defines how many results to show per page (50) |

Sources: [src/js/tools/media.js L11-L19](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/media.js#L11-L19)

### Workflow and User Interaction

When activated, the Media Tool automatically launches a search dialog:

1. The `on_activate()` method triggers the `search()` method
2. The search dialog is displayed using Dialog_class
3. When a search query is submitted: * The tool constructs a URL to query the Pixabay API * It checks the cache first to avoid unnecessary API calls * Results are fetched and displayed in a grid layout
4. When a user clicks on an image: * The image URL is passed to the File_open_class * The image is imported into the editor * The tool is automatically switched to the Select tool

Sources: [src/js/tools/media.js L30-L161](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/media.js#L30-L161)

### Search Dialog Implementation

The search dialog is created using the Dialog_class and includes:

1. A search input field
2. A results grid displaying image thumbnails
3. Pagination controls for navigating through results

```

```

Sources: [src/js/tools/media.js L41-L161](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/media.js#L41-L161)

### Search Results Caching

The Media Tool implements a simple caching mechanism to improve performance:

1. Each API URL (including query parameters) serves as a cache key
2. When a search is performed, the tool first checks if the results are already in the cache
3. If found, the cached results are used instead of making a new API request
4. If not found, the API request is made and results are stored in the cache

This approach reduces API calls and improves response time for repeated searches.

Sources: [src/js/tools/media.js L125-L155](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/media.js#L125-L155)

### Pagination Implementation

The Media Tool includes pagination to navigate through large result sets:

1. Results are limited to 50 per page (defined by the `per_page` property)
2. The current page is tracked in the `page` property
3. Pagination controls are rendered below the search results
4. The tool shows up to 10 page buttons at a time
5. Previous/Next buttons allow for easy navigation

When a user clicks a page button, the tool updates the `page` property and resubmits the search query.

Sources: [src/js/tools/media.js L63-L74](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/media.js#L63-L74)

 [src/js/tools/media.js L106-L113](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/media.js#L106-L113)

### Error Handling

The Media Tool handles several error scenarios:

1. When no results are found, an error message is displayed: "Your search did not match any images."
2. If there's an error connecting to the Pixabay API, an error message is shown: "Error connecting to service."

Sources: [src/js/tools/media.js L133-L134](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/media.js#L133-L134)

 [src/js/tools/media.js L145-L154](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/media.js#L145-L154)

## Configuration Options

The Media Tool uses the following configuration options:

1. **Pixabay API Key**: Stored in `config.pixabay_key` (note: the key is reversed in the code for obfuscation)
2. **Safe Search**: Retrieved from user settings using `Tools_settings.get_setting('safe_search')`

These configuration options affect how the tool interacts with the Pixabay API.

Sources: [src/js/tools/media.js L46-L49](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/media.js#L46-L49)

 [src/js/tools/media.js L119-L123](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/tools/media.js#L119-L123)

## Usage Notes

* The Media Tool is designed for quickly finding and importing images from Pixabay
* Results are subject to Pixabay's terms of service and licensing
* Safe search can be enabled/disabled in the settings
* The tool automatically caches previous search results to improve performance
* After selecting an image, the tool automatically switches to the Select tool for convenience