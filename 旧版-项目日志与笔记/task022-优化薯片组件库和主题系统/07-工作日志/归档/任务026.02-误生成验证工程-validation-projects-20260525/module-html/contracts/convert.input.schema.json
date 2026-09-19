{
  "type": "object",
  "required": ["htmlDir", "outputFile", "options"],
  "properties": {
    "htmlDir": {
      "type": "string",
      "minLength": 1
    },
    "entryFile": {
      "type": "string"
    },
    "outputFile": {
      "type": "string",
      "minLength": 1
    },
    "options": {
      "type": "object",
      "required": ["target"],
      "properties": {
        "target": {
          "type": "string",
          "enum": ["pdf", "image"]
        },
        "pdf": {
          "type": "object",
          "additionalProperties": true
        },
        "image": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
