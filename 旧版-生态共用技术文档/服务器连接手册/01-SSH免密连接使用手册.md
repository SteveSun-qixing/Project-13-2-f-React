# SSH 免密连接使用手册

## 1. 文档定位

本文档是薯片生态服务器运维连接的通用技术手册，记录通过 SSH 公钥认证连接生产或运维服务器的标准方法。

正式对外口径：

- 服务器连接优先使用 SSH 公钥认证；
- 本机通过 `~/.ssh/config` 配置稳定的 Host 别名；
- 部署、同步文件、查看日志和执行远程命令统一使用 Host 别名；
- 文档、日志和命令示例不得记录服务器密码、私钥、Access Key、Secret Key 等敏感信息。

当前已落地实例：

- 薯片社区服务器已配置本机 Host 别名 `chipscard-server`；
- 该别名指向生产服务器 `111.92.241.17` 的 SSH 端口 `22`；
- 当前登录用户为 `root`；
- 当前连接方式已验证为 SSH 公钥认证。

- 薯片个人服务器已配置本机 Host 别名 `chipscard-personal-server`；
- 该别名指向生产服务器 `103.185.248.114` 的 SSH 端口 `22`；
- 当前登录用户为 `root`；
- 当前连接方式已验证为 SSH 公钥认证（私钥 `~/.ssh/chipscard_personal_ed25519`）。

## 2. 基本连接方式

后续连接薯片社区服务器时，直接使用：

```bash
ssh chipscard-server
```

执行远程单条命令：

```bash
ssh chipscard-server 'hostname && pwd'
```

查看社区服务器 Docker Compose 状态：

```bash
ssh chipscard-server 'cd /opt/chips-runtime/Chips-CommunityPlatformServer/deploy && docker compose ps'
```

进入生产部署目录：

```bash
ssh chipscard-server
cd /opt/chips-runtime/Chips-CommunityPlatformServer/deploy
```

个人服务器（`chipscard-personal-server`，生产目录 `/opt/chips-runtime/Chips-PersonalServer`）：

```bash
ssh chipscard-personal-server 'cd /opt/chips-runtime/Chips-PersonalServer/deploy && docker compose -f docker-compose.prod.yml --env-file .env ps'
```

个人服务器使用 1Panel 面板管理（`1pctl` 命令可查看面板状态），部署目录为 `/opt/chips-runtime/Chips-PersonalServer`，生产 compose 为 `docker-compose.prod.yml`（对象存储使用七牛云，固定项目名 `cps`）。

## 3. 本机 SSH 配置

本机配置文件位置：

```text
~/.ssh/config
```

当前薯片社区服务器 Host 配置：

```sshconfig
Host chipscard-server
    HostName 111.92.241.17
    Port 22
    User root
    IdentityFile ~/.ssh/chipscard_server_ed25519
    IdentitiesOnly yes
    ServerAliveInterval 30
    ServerAliveCountMax 4
    TCPKeepAlive yes
```

配置说明：

- `Host chipscard-server` 是本机连接别名；
- `HostName` 是服务器公网 IP；
- `Port` 是 SSH 端口；
- `User` 是远端登录用户；
- `IdentityFile` 是本机私钥路径，只能保存在本机，不得写入仓库；
- `IdentitiesOnly yes` 用于确保只使用指定私钥，避免 SSH 尝试过多无关密钥；
- `ServerAliveInterval 30` 每 30 秒发送一次 SSH 保活；
- `ServerAliveCountMax 4` 连续 4 次无响应后断开；
- `TCPKeepAlive yes` 开启 TCP 层保活。

## 4. 密钥文件与权限

当前本机专用密钥路径：

```text
私钥：~/.ssh/chipscard_server_ed25519
公钥：~/.ssh/chipscard_server_ed25519.pub
```

权限要求：

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/chipscard_server_ed25519
chmod 644 ~/.ssh/chipscard_server_ed25519.pub
chmod 600 ~/.ssh/config
```

服务器端公钥保存位置：

```text
/root/.ssh/authorized_keys
```

服务器端权限要求：

```bash
chmod 700 /root
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys
```

敏感信息规则：

- 私钥文件不得复制给他人；
- 私钥文件不得提交到 Git；
- 私钥内容不得写入项目日志、技术文档、聊天记录或部署脚本；
- 如果怀疑私钥泄露，应立即从服务器 `authorized_keys` 移除对应公钥，并重新生成密钥。

## 5. 连接验证

验证当前 Host 别名是否生效：

```bash
ssh -G chipscard-server | grep -E '^(hostname|user|port|identityfile|identitiesonly|serveraliveinterval|serveralivecountmax|tcpkeepalive) '
```

验证是否可以免密登录：

```bash
ssh -o BatchMode=yes -o ConnectTimeout=15 chipscard-server 'hostname; id -un; pwd; date -u +%Y-%m-%dT%H:%M:%SZ'
```

如果该命令成功返回服务器信息，说明不需要密码即可登录。

验证是否真正使用公钥认证：

```bash
ssh -vvv -o BatchMode=yes chipscard-server 'true' 2>&1 | grep -E 'Offering public key|Server accepts key|Authenticated to|Permission denied'
```

成功时应看到类似信息：

```text
Offering public key: ~/.ssh/chipscard_server_ed25519
Server accepts key: ~/.ssh/chipscard_server_ed25519
Authenticated to 111.92.241.17 using "publickey".
```

## 6. 文件同步用法

从本机同步文件到服务器：

```bash
scp /本机/文件路径 chipscard-server:/服务器/目标路径
```

示例：同步项目日志到服务器：

```bash
scp '项目日志与笔记/task020-社区服务器生产域名与七牛云对象存储部署/01-全过程详细工作日志.md' \
  'chipscard-server:/opt/chips-runtime/项目日志与笔记/task020-社区服务器生产域名与七牛云对象存储部署/01-全过程详细工作日志.md'
```

使用 `rsync` 同步目录：

```bash
rsync -avz /本机/目录/ chipscard-server:/服务器/目录/
```

同步源码时应先明确目标目录，不要把文件直接同步到仓库根目录。需要移除误放文件时，遵守项目规则，移动到就近 `归档/` 目录，不直接删除。

## 7. 部署命令用法

查看生产容器状态：

```bash
ssh chipscard-server 'cd /opt/chips-runtime/Chips-CommunityPlatformServer/deploy && docker compose ps'
```

重建前台 Web 容器：

```bash
ssh chipscard-server 'cd /opt/chips-runtime/Chips-CommunityPlatformServer/deploy && docker compose build web && docker compose up -d web'
```

重建服务端容器：

```bash
ssh chipscard-server 'cd /opt/chips-runtime/Chips-CommunityPlatformServer/deploy && docker compose build server && docker compose up -d server'
```

查看服务端日志：

```bash
ssh chipscard-server 'cd /opt/chips-runtime/Chips-CommunityPlatformServer/deploy && docker compose logs --tail=200 server'
```

执行生产健康检查：

```bash
curl -sS https://www.chipscard.space/api/v1/health
```

## 8. 服务器端 SSH 设置

服务器端 SSH 服务需要开启公钥认证：

```text
PubkeyAuthentication yes
```

当前服务器有效配置已验证为：

```text
permitrootlogin yes
pubkeyauthentication yes
passwordauthentication yes
authorizedkeysfile .ssh/authorized_keys .ssh/authorized_keys2
```

说明：

- `pubkeyauthentication yes` 是免密登录生效的必要条件；
- 当前保留 `passwordauthentication yes` 作为备用入口；
- 如果后续确认公钥连接长期稳定，可以再评估是否关闭密码登录；
- 修改 SSH 服务端配置前必须先备份 `/etc/ssh/sshd_config`；
- 修改后必须先执行 `sshd -t` 校验配置，再 reload SSH 服务。

## 9. 常见问题

### 9.1 仍然提示输入密码

优先检查：

```bash
ssh -G chipscard-server | grep -E '^(hostname|user|port|identityfile|identitiesonly) '
```

再检查服务器是否开放公钥认证：

```bash
ssh chipscard-server 'sshd -T 2>/dev/null | grep -E "^(pubkeyauthentication|authorizedkeysfile|passwordauthentication|permitrootlogin) "'
```

如果 `pubkeyauthentication no`，需要在服务器 SSH 配置中开启公钥认证。

### 9.2 Permission denied publickey

常见原因：

- 本机 `IdentityFile` 指向了错误私钥；
- 服务器 `authorized_keys` 没有对应公钥；
- 本机或服务器端 `.ssh` 文件权限过宽；
- 远端登录用户不正确；
- 服务器 SSH 配置禁用了公钥认证。

### 9.3 长时间部署连接中断

优先确认本机 Host 配置包含：

```sshconfig
ServerAliveInterval 30
ServerAliveCountMax 4
TCPKeepAlive yes
```

长时间构建时可以使用远程终端复用工具或把构建命令拆成可重复执行的步骤；正式部署仍以 Docker Compose 状态和健康检查作为最终判断。

## 10. 安全建议

- 当前服务器密码曾在人工对话中出现过，应尽快轮换；
- 七牛云 Access Key 和 Secret Key 曾在人工对话中出现过，也应尽快轮换；
- 1Panel 管理端口如对公网开放，应启用强密码、访问限制和登录保护；
- 服务器连接文档只记录连接方法，不记录任何明文密钥；
- 每次新增运维人员时，应为其创建独立公钥，不共用同一私钥；
- 离职、设备丢失或密钥泄露时，应及时从 `authorized_keys` 移除对应公钥。
