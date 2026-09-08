/**
 * Ambient type shim for the "vitest" module.
 *
 * 为什么存在：MemoryCore 的 package.json 声明了 vitest ^4.1.2（devDependency），
 * 但当前工作树的 node_modules 是受损后部分恢复的 —— @vitest/* scope 与 vitest
 * 本体没有落地（pnpm corepack 缓存亦损坏、无 pnpm-lock.yaml，全量重装有版本
 * 漂移风险）。测试文件本身是完好的源码，为了让 `tsc --noEmit` 严格扫描能覆盖
 * 测试文件（而不是把它们排除出 include），这里给出宽松但完整的类型声明。
 *
 * 注意：一旦 vitest 真实安装（node_modules/vitest 存在），TypeScript 会优先
 * 解析真实模块类型，本 ambient 声明自动失效 —— 因此不会污染真实环境。
 *
 * 类型策略：断言链（expect(...).not.toBe(...)）各环节返回 this 风格的
 * loose matcher，保持链式可用；vi.fn 返回宽松 Mock（调用记录/返回值桩
 * 均为可写属性）。
 */

declare module "vitest" {
  /** 测试函数体。 */
  type TestFn = () => void | Promise<void>;
  type HookFn = () => void | Promise<void> | (() => void | Promise<void>);

  /** it/test/describe 的可变体：可调用 + skip/only/todo 修饰。 */
  interface TestRegistrar {
    (name: string, fn?: TestFn, timeout?: number): void;
    skip(name: string, fn?: TestFn, timeout?: number): void;
    only(name: string, fn?: TestFn, timeout?: number): void;
    todo(name: string): void;
    fails(name: string, fn?: TestFn, timeout?: number): void;
    concurrent(name: string, fn?: TestFn, timeout?: number): void;
  }

  interface SuiteRegistrar {
    (name: string, fn: () => void): void;
    skip(name: string, fn: () => void): void;
    only(name: string, fn: () => void): void;
    todo(name: string): void;
  }

  /** 断言链节点：所有 matcher 返回自身，支持 .not.x / .resolves.x 链。 */
  interface Assertion<T = unknown> {
    // negation / async 轴
    not: Assertion<T>;
    resolves: Assertion<unknown>;
    rejects: Assertion<unknown>;

    // equality
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toStrictEqual(expected: unknown): void;
    toMatchObject(expected: Record<string, unknown>): void;

    // truthiness / identity
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toNaN(): void;

    // numbers
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toBeCloseTo(expected: number, precision?: number): void;

    // containers / strings
    toContain(item: unknown): void;
    toContainEqual(item: unknown): void;
    toHaveLength(len: number): void;
    toMatch(pattern: string | RegExp): void;
    toHaveProperty(key: string | string[], value?: unknown): void;

    // functions / mocks
    toHaveBeenCalled(): void;
    toHaveBeenCalledTimes(n: number): void;
    toHaveBeenCalledWith(...args: unknown[]): void;
    toHaveBeenLastCalledWith(...args: unknown[]): void;
    toHaveBeenNthCalledWith(n: number, ...args: unknown[]): void;

    // errors
    toThrow(expected?: string | RegExp | ErrorConstructor): void;
    toBeInstanceOf(constructor: unknown): void;
    toThrowError(expected?: string | RegExp | ErrorConstructor): void;

    // snapshots / misc
    toMatchSnapshot(): void;
    toMatchInlineSnapshot(snapshot?: string): void;
    toHaveReturned(): void;
    toHaveReturnedTimes(n: number): void;
    toHaveReturnedWith(value: unknown): void;
  }

  /** vi.fn() 产物：宽松 Mock。 */
  interface MockFunction<F extends (...args: any[]) => any> {
    (...args: Parameters<F>): ReturnType<F>;
    mock: {
      calls: any[][];
      results: { type: string; value: any }[];
      instances: any[];
      lastCall: any[];
    };
    mockReturnValue(value: unknown): MockFunction<F>;
    mockReturnValueOnce(value: unknown): MockFunction<F>;
    mockResolvedValue(value: unknown): MockFunction<F>;
    mockResolvedValueOnce(value: unknown): MockFunction<F>;
    mockRejectedValue(value: unknown): MockFunction<F>;
    mockRejectedValueOnce(value: unknown): MockFunction<F>;
    mockImplementation(impl: (...args: any[]) => any): MockFunction<F>;
    mockImplementationOnce(impl: (...args: any[]) => any): MockFunction<F>;
    mockClear(): MockFunction<F>;
    mockReset(): MockFunction<F>;
    mockRestore(): MockFunction<F>;
  }

  export const describe: SuiteRegistrar;
  export const it: TestRegistrar;
  export const test: TestRegistrar;

  export function expect<T = unknown>(actual: T, message?: string): Assertion<T>;
  namespace expect {
    function any(constructor: unknown): unknown;
    function anything(): unknown;
    function arrayContaining(items: readonly unknown[]): unknown[];
    function objectContaining(obj: Record<string, unknown>): Record<string, unknown>;
    function stringContaining(s: string): string;
    function extend(matchers: Record<string, unknown>): void;
  }

  export function beforeEach(fn: HookFn, timeout?: number): void;
  export function afterEach(fn: HookFn, timeout?: number): void;
  export function beforeAll(fn: HookFn, timeout?: number): void;
  export function afterAll(fn: HookFn, timeout?: number): void;

  export const vi: {
    fn<F extends (...args: any[]) => any = (...args: any[]) => any>(impl?: F): MockFunction<F>;
    mock(path: string, factory?: (importOriginal: <T>() => Promise<T>) => unknown): void;
    /** 交回带完整 Mock API（含 .mock 记录与 mockResolvedValue 等）的交集类型。 */
    mocked<T>(item: T): T & MockFunction<(...args: any[]) => any>;
    spyOn<T>(obj: T, method: keyof T): MockFunction<never>;
    stubGlobal(name: string, value: unknown): void;
    unstubAllGlobals(): void;
    stubEnv(name: string, value: string | undefined): void;
    unstubAllEnvs(): void;
    clearAllMocks(): void;
    resetAllMocks(): void;
    restoreAllMocks(): void;
    useFakeTimers(): void;
    useRealTimers(): void;
    setSystemTime(time: number | string | Date): void;
    hoisted<T>(factory: () => T): T;
  };
}
