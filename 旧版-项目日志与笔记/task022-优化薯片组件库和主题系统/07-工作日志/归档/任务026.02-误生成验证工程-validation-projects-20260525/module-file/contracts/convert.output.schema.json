{
  "type": "object",
  "required": ["outputPath", "artifacts", "handledBy"],
  "properties": {
    "outputPath": {
      "type": "string"
    },
    "artifacts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "path"],
        "properties": {
          "type": {
            "type": "string"
          },
          "path": {
            "type": "string"
          },
          "mimeType": {
            "type": "string"
          }
        },
        "additionalProperties": false
      }
    },
    "handledBy": {
      "type": "string"
    },
    "warnings": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["code", "message"],
        "properties": {
          "code": {
            "type": "string"
          },
          "message": {
            "type": "string"
          },
          "details": {}
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
