import { defineConfig } from 'vitest/config';

// 测试全部是纯逻辑（无 JSX/插件依赖），独立配置即可。
// 性质测试（45 档 × 500 次生成的全量遍历）在 CI 慢跑器上会超过默认 5s 单测超时，故上调。
export default defineConfig({
  test: { testTimeout: 60_000 },
});
