{
  "type": "object",
  "required": ["outputFile", "target", "handledBy"],
  "properties": {
    "outputFile": {
      "type": "string"
    },
    "target": {
      "type": "string",
      "enum": ["pdf", "image"]
    },
    "format": {
      "type": "string"
    },
    "pageCount": {
      "type": "number"
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
