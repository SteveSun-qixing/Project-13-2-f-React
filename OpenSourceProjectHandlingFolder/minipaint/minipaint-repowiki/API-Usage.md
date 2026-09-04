# API Usage

> **Relevant source files**
> * [examples/add-edit-imgData.html](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/add-edit-imgData.html)
> * [examples/open-edit-save.html](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/open-edit-save.html)
> * [examples/zoom.html](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/zoom.html)
> * [src/js/main.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/main.js)

This document provides comprehensive information on how to use miniPaint programmatically via its exposed API. It covers how to integrate miniPaint into your own applications, control it programmatically, and interact with its core functionality through JavaScript.

## 1. API Overview

miniPaint exposes several key objects globally when embedded in a webpage, allowing external scripts to interact with the editor. These objects provide access to the core functionality of miniPaint.

```

```

Sources: [src/js/main.js L46-L52](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/main.js#L46-L52)

## 2. Embedding miniPaint

To use miniPaint's API, you first need to embed it within your application using an iframe.

```

```

After embedding, you can access the API objects through the iframe's content window:

```

```

Sources: [examples/open-edit-save.html L4](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/open-edit-save.html#L4-L4)

 [examples/zoom.html L4](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/zoom.html#L4-L4)

 [examples/add-edit-imgData.html L4](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/add-edit-imgData.html#L4-L4)

## 3. Layer Management API

The `Layers` object is the most frequently used API for manipulating image content in miniPaint. It allows you to add, update, and manipulate layers programmatically.

### 3.1 Layer Structure

A layer in miniPaint is represented as an object with the following properties:

| Property | Type | Description |
| --- | --- | --- |
| name | string | Layer name |
| type | string | Layer type ('image', 'rectangle', etc.) |
| data | mixed | Layer data (image, text, etc.) |
| x | number | X position of the layer |
| y | number | Y position of the layer |
| width | number | Width of the layer |
| height | number | Height of the layer |
| params | object | Additional parameters specific to layer type |

### 3.2 Adding Layers

To insert a new layer, use the `Layers.insert()` method:

```

```

Sources: [examples/open-edit-save.html L29-L46](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/open-edit-save.html#L29-L46)

 [examples/add-edit-imgData.html L14-L28](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/add-edit-imgData.html#L14-L28)

### 3.3 Updating Layers

You can update a layer by converting it to a canvas, modifying the canvas, and then updating it:

```

```

Sources: [examples/add-edit-imgData.html L44-L54](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/add-edit-imgData.html#L44-L54)

### 3.4 Getting Canvas Representation

To render all layers to a single canvas:

```

```

Sources: [examples/open-edit-save.html L62-L69](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/open-edit-save.html#L62-L69)

 [examples/open-edit-save.html L97-L104](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/open-edit-save.html#L97-L104)

## 4. File Operations API

miniPaint provides APIs for opening and saving files programmatically.

```

```

Sources: [examples/open-edit-save.html L49-L93](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/open-edit-save.html#L49-L93)

### 4.1 Opening Files

#### Opening Images

```

```

#### Opening JSON Project Files

```

```

Sources: [examples/open-edit-save.html L29-L46](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/open-edit-save.html#L29-L46)

 [examples/open-edit-save.html L49-L60](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/open-edit-save.html#L49-L60)

### 4.2 Saving Files

#### Saving as Image

```

```

#### Saving as JSON

```

```

Sources: [examples/open-edit-save.html L62-L84](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/open-edit-save.html#L62-L84)

 [examples/open-edit-save.html L86-L93](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/open-edit-save.html#L86-L93)

## 5. Canvas Manipulation API

miniPaint provides APIs for manipulating the canvas view, such as zooming and positioning.

### 5.1 Canvas Dimensions

You can set the canvas dimensions using the GUI API:

```

```

Sources: [examples/zoom.html L19](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/zoom.html#L19-L19)

### 5.2 Zooming and Positioning

The zoom API allows you to control the view of the canvas:

```

```

```

```

Sources: [examples/zoom.html L43-L69](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/zoom.html#L43-L69)

## 6. Common Use Cases

### 6.1 Open-Edit-Save Workflow

A common use case is to open an image, edit it in miniPaint, and then save the result:

1. Embed miniPaint in your application
2. Open an image from your application into miniPaint
3. Allow user to edit the image in miniPaint
4. Retrieve the edited image from miniPaint
5. Update your application with the edited image

```

```

Sources: [examples/open-edit-save.html L95-L109](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/open-edit-save.html#L95-L109)

### 6.2 Programmatically Drawing Elements

You can use the API to programmatically add and manipulate elements in miniPaint:

```

```

Sources: [examples/zoom.html L22-L40](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/zoom.html#L22-L40)

## 7. Advanced Integration

For more complex scenarios, you may need to interact with multiple API objects:

```

```

Sources: [examples/zoom.html L12-L52](https://github.com/viliusle/miniPaint/blob/6d0b95e5/examples/zoom.html#L12-L52)

## 8. Conclusion

The miniPaint API provides a powerful way to integrate advanced image editing capabilities into your web applications. By using the exposed objects (`Layers`, `AppConfig`, `State`, `FileOpen`, `FileSave`), you can control almost all aspects of the editor programmatically.

For examples of API usage, refer to the example files in the miniPaint repository:

* open-edit-save.html
* zoom.html
* add-edit-imgData.html