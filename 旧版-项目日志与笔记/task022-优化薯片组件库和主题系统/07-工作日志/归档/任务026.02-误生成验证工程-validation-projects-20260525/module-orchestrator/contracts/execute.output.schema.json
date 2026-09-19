{
  "type": "object",
  "required": ["results", "handledBy"],
  "properties": {
    "results": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["capability", "method", "mode"],
        "properties": {
          "capability": {
            "type": "string"
          },
          "method": {
            "type": "string"
          },
          "mode": {
            "type": "string",
            "enum": ["sync", "job"]
          },
          "output": {}
        },
        "additionalProperties": false
      }
    },
    "handledBy": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
