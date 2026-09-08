# dsh-rate-limit-retry

DeepSeek Harness 插件：当 API 返回「访问过于频繁:api-key请求token数超出分钟限制」等频率限制错误时，等待 **3 分钟**后再重试，而不是使用默认的亚秒级退避延迟。

## 工作原理

该插件注册到 `agent/request-error` 瀑布事件中，检测频率限制错误消息：

1. 匹配到频率限制错误时，等待 **3 分钟**
2. 返回 `{ kind: 'retry' }` 让 agent 重试请求
3. 其他类型的错误照常交给内置的 `llm-retry` 策略处理
4. 单步最多重试 **10 次**，超过后委托给下游

## 安装

```bash
# 安装到 web 配置文件（应用于 Web GUI）
dsh plugin --profile web add ./dsh-rate-limit-retry

# 安装到 cli 配置文件（应用于命令行）
dsh plugin --profile cli add ./dsh-rate-limit-retry
```

安装后重启 DSH 即可生效。

## 自定义

如需修改等待时间、匹配模式或最大重试次数，编辑 `index.js` 中的常量：

```javascript
const RETRY_DELAY_MS = 3 * 60 * 1000  // 等待时间（毫秒）
const MAX_RETRIES = 10                 // 最大重试次数
const RATE_LIMIT_PATTERNS = [...]      // 匹配模式列表
```

## 文件结构

```
dsh-rate-limit-retry/
├── package.json        # 包清单，声明 dsh.bundle.patch
├── cordis.patch.yml    # 将插件注册到 Cordis 配置文件
├── index.js            # 插件实现
└── README.md           # 本文件
```

## 许可证

MIT