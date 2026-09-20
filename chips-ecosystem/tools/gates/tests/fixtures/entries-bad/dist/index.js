import fs from 'node:fs';

export function register() {
  return fs.constants.F_OK;
}
