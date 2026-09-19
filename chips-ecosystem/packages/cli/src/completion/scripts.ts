/**
 * Shell 补全脚本（[CLI 完整参考] §3.9、§4.5）。
 *
 * 脚本每次补全都调用私有入口 `chips __complete`（开发侧为 `chips dev __complete`），
 * 由 CLI 现场读取最新命令索引；安装/启用/禁用/卸载后无需重装脚本。
 */

import type { CliEntryKind } from '../args/global-options.js';

/** 支持的 shell。 */
export const COMPLETION_SHELLS: readonly string[] = ['bash', 'zsh', 'fish'];

/** 生成补全脚本。 */
export function renderCompletionScript(shell: string, entry: CliEntryKind): string {
  const prefix = entry === 'dev' ? 'chips dev' : 'chips';
  switch (shell) {
    case 'bash':
      return bashScript(prefix);
    case 'zsh':
      return zshScript(prefix);
    case 'fish':
      return fishScript(entry);
    default:
      return '';
  }
}

function bashScript(prefix: string): string {
  return `# 薯片生态 ${prefix} 补全脚本（bash）
_chips_complete() {
  local candidates
  candidates=$(${prefix} __complete "\${COMP_WORDS[@]:1:COMP_CWORD}" 2>/dev/null)
  COMPREPLY=( $(compgen -W "\${candidates}" -- "\${COMP_WORDS[COMP_CWORD]}") )
  return 0
}
complete -F _chips_complete chips
`;
}

function zshScript(prefix: string): string {
  return `# 薯片生态 ${prefix} 补全脚本（zsh）
_chips_complete() {
  local -a candidates
  candidates=("\${(@f)$(${prefix} __complete "\${words[@]:1}" 2>/dev/null)}")
  compadd -a candidates
}
compdef _chips_complete chips
`;
}

function fishScript(entry: CliEntryKind): string {
  const call = entry === 'dev' ? 'chips dev __complete' : 'chips __complete';
  return `# 薯片生态 chips${entry === 'dev' ? ' dev' : ''} 补全脚本（fish）
function __chips_complete
    set -l tokens (commandline -opc) (commandline -ct)
    set -e tokens[1]
    ${call} $tokens 2>/dev/null
end
complete -c chips -f -a "(__chips_complete)"
`;
}
