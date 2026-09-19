{
  "type": "object",
  "required": ["steps"],
  "properties": {
    "steps": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["capability", "method", "input"],
        "properties": {
          "capability": {
            "type": "string",
            "minLength": 1
          },
          "method": {
            "type": "string",
            "minLength": 1
          },
          "input": {
            "type": "object",
            "additionalProperties": true
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
