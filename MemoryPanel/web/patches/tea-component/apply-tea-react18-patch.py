#!/usr/bin/env python3
"""
tea-component 2.8.0 React 18 兼容补丁（TDAI）

消除三类库内遗留 API 在 React 18 (dev/StrictMode) 下的控制台告警：

  1. forwardRef render functions accept exactly two parameters
     → es/_util/forward-ref-with-statics.js：包一层恒定双参 render。
  2. findDOMNode is deprecated（Popover/Dropdown 触发器锚点）
     → es/domref/DomRef.js：优先用子元素 ref 捕获 DOM，类组件实例才回退 findDOMNode。
  3. ReactDOM.render is no longer supported in React 18
     → notification/Message/ModalAlert/ModalConfirm/ModalShow 五个 API 弹层
       改为 ReactDOM.createRoot().render() / root.unmount()。

幂等：重复执行不会二次修改（以 "TDAI patch" 标记判别）。
仅改 es/（vite 按 package.json module 字段只会打包 es/；应用未引用 lib/）。
执行后需重启 vite dev（或删除 node_modules/.vite 缓存）让依赖重新预构建。
"""
import sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2] / "node_modules" / "tea-component" / "es"
MARK = "TDAI patch"

def patch(rel: str, replacements: list, add_import=None):
    p = ROOT / rel
    src = p.read_text(encoding="utf-8")
    if MARK in src:
        print(f"  [skip] {rel}（已打过补丁）")
        return
    orig = src
    for old, new in replacements:
        if old not in src:
            sys.exit(f"  [FAIL] {rel}: 未找到目标片段:\n{old[:120]}...")
        src = src.replace(old, new, 1)
    if add_import and add_import not in src:
        first_import_end = src.index("\n", src.index("import "))
        src = src[:first_import_end + 1] + add_import + "\n" + src[first_import_end + 1:]
    p.write_text(src, encoding="utf-8")
    print(f"  [ok]   {rel}" + ("（+import）" if add_import and add_import not in orig else ""))

# ── 1. forwardRef 双参告警：52 个消费方一次修完 ─────────────────────────────
patch("_util/forward-ref-with-statics.js", [(
    """export function forwardRefWithStatics(component, statics) {
    return hoistNonReactStatics(forwardRef(component), statics);
}""",
    """export function forwardRefWithStatics(component, statics) {
    // [TDAI patch] React 18 要求 forwardRef render 恒为双参（props, ref）。
    // 包装原始 render，保证 React 恒见双参函数，原 arity 与行为不变。
    var render = function (props, ref) { return component(props, ref); };
    render.displayName = component.displayName || component.name;
    return hoistNonReactStatics(forwardRef(render), statics);
}""",
)])

# ── 2. DomRef findDOMNode：ref 捕获为主、findDOMNode 兜底 ──────────────────
patch("domref/DomRef.js", [
    (
        """import { mergeRefs } from "../_util/merge-refs";
import { attachProps } from "../_util/attach-props";""",
        """import { mergeRefs } from "../_util/merge-refs";
import { attachProps } from "../_util/attach-props";
// [TDAI patch] 判断子元素类型能否安全接受 ref（避免对普通函数组件
// 传 ref 触发 React "cannot be given refs" 告警）。
var ForwardRefSymbol = typeof Symbol === "function" ? Symbol.for("react.forward_ref") : 0xead0;
var MemoSymbol = typeof Symbol === "function" ? Symbol.for("react.memo") : 0xead3;
function canTakeRef(type) {
    if (typeof type === "string")
        return true;
    if (!type)
        return false;
    if (type.$$typeof === ForwardRefSymbol)
        return true;
    if (type.$$typeof === MemoSymbol)
        return canTakeRef(type.type);
    if (typeof type === "function" && type.prototype && type.prototype.isReactComponent)
        return true;
    return false;
}""",
    ),
    (
        """    DomRefInner.prototype.componentDidMount = function () {
        var dom = ReactDOM.findDOMNode(this); // eslint-disable-line react/no-find-dom-node
        var domRef = this.props.domRef;
        mergeRefs(domRef)(dom);
    };
    DomRefInner.prototype.componentDidUpdate = function () {
        var dom = ReactDOM.findDOMNode(this); // eslint-disable-line react/no-find-dom-node
        var domRef = this.props.domRef;
        mergeRefs(domRef)(dom);
    };""",
        """    DomRefInner.prototype.componentDidMount = function () {
        var dom = this._resolveDom();
        var domRef = this.props.domRef;
        mergeRefs(domRef)(dom);
    };
    DomRefInner.prototype.componentDidUpdate = function () {
        var dom = this._resolveDom();
        var domRef = this.props.domRef;
        mergeRefs(domRef)(dom);
    };
    // [TDAI patch] React 18 弃用 findDOMNode：优先用子元素 ref 捕获的 DOM 节点；
    // 仅当子元素暴露的是类组件实例（拿不到元素）时才回退 findDOMNode。
    DomRefInner.prototype._resolveDom = function () {
        var captured = this._capturedDom;
        if (captured && captured.nodeType === 1) {
            return captured;
        }
        return ReactDOM.findDOMNode(this);
    };""",
    ),
    (
        """        if (React.isValidElement(childrenElement)) {
            return React.cloneElement(childrenElement, attachProps(childrenElement.props, props));
        }
        return children;
    };
    return DomRefInner;""",
        """        if (React.isValidElement(childrenElement)) {
            // [TDAI patch] 通过合并 ref 捕获子元素 DOM，替代 findDOMNode。
            // 仅当子元素类型确定接受 ref（DOM 元素/forwardRef/类组件/memo 包裹）
            // 时才挂 ref——否则会触发 React 的 "cannot be given refs" 新告警。
            var config = attachProps(childrenElement.props, props);
            if (canTakeRef(childrenElement.type)) {
                config.ref = mergeRefs(childrenElement.ref, function (node) {
                    _this._capturedDom = node;
                });
            }
            return React.cloneElement(childrenElement, config);
        }
        return children;
    };
    return DomRefInner;""",
    ),
    (
        """    DomRefInner.prototype.render = function () {
        var _a = this.props""",
        """    DomRefInner.prototype.render = function () {
        var _this = this;
        var _a = this.props""",
    ),
])

# ── 3. 五个 API 弹层：ReactDOM.render → createRoot ─────────────────────────
# 共同变换：render 语句前注入 root 句柄；`ReactDOM.render(` → `root.render(`；
# 尾参 `, el)` 移除（createRoot 已绑定容器）；unmount → root.unmount()。

patch("notification/Notification.js", [(
    """    var el = document.createElement("div");
    var instanceRef = React.createRef();
    var show = function () {
        ReactDOM.render(React.createElement(ConfigProvider, null,
            React.createElement(Notification, __assign({}, options, configStore, { type: type, ref: instanceRef, onClose: function () {
                    onClose();
                    onExited();
                    unmountComponentAtNode(el);
                } }))), el);
    };""",
    """    var el = document.createElement("div");
    var instanceRef = React.createRef();
    var root = null; // [TDAI patch] React 18 createRoot
    var show = function () {
        root = ReactDOM.createRoot(el);
        root.render(React.createElement(ConfigProvider, null,
            React.createElement(Notification, __assign({}, options, configStore, { type: type, ref: instanceRef, onClose: function () {
                    onClose();
                    onExited();
                    root.unmount();
                } }))));
    };""",
)])

patch("message/Message.js", [(
    """    var el = document.createElement("div");
    var instanceRef = React.createRef();
    ReactDOM.render(React.createElement(ConfigProvider, null,
        React.createElement(Message, __assign({}, options, configStore, { type: type, ref: instanceRef, onClose: function () {
                onClose();
                unmountComponentAtNode(el);
            } }))), el);""",
    """    var el = document.createElement("div");
    var instanceRef = React.createRef();
    var root = ReactDOM.createRoot(el); // [TDAI patch] React 18 createRoot
    root.render(React.createElement(ConfigProvider, null,
        React.createElement(Message, __assign({}, options, configStore, { type: type, ref: instanceRef, onClose: function () {
                onClose();
                root.unmount();
            } }))));""",
)])

patch("modal/ModalAlert.js", [(
    """        var el = document.createElement("div");
        ReactDOM.render(React.createElement(ConfigProvider, null,
            React.createElement(ModalAlertAPI, __assign({}, restOptions, { onButtonClick: function () { return resolve(); }, onExited: function () {
                    onExited();
                    ReactDOM.unmountComponentAtNode(el);
                } }))), el);""",
    """        var el = document.createElement("div");
        var root = ReactDOM.createRoot(el); // [TDAI patch] React 18 createRoot
        root.render(React.createElement(ConfigProvider, null,
            React.createElement(ModalAlertAPI, __assign({}, restOptions, { onButtonClick: function () { return resolve(); }, onExited: function () {
                    onExited();
                    root.unmount();
                } }))));""",
)])

patch("modal/ModalConfirm.js", [(
    """                }); }, onExited: function () {
                    ReactDOM.unmountComponentAtNode(el);
                } }))), el);""",
    """                }); }, onExited: function () {
                    root.unmount(); // [TDAI patch] React 18 createRoot
                } }))));""",
), (
    """        var el = document.createElement("div");
        ReactDOM.render(React.createElement(ConfigProvider, null,
            React.createElement(ModalConfirmAPI,""",
    """        var el = document.createElement("div");
        var root = ReactDOM.createRoot(el); // [TDAI patch] React 18 createRoot
        root.render(React.createElement(ConfigProvider, null,
            React.createElement(ModalConfirmAPI,""",
)])

patch("modal/ModalShow.js", [(
    """    var el = document.createElement("div");
    var instanceRef = React.createRef();
    ReactDOM.render(React.createElement(ConfigProvider, null,
        React.createElement(ModalShow, __assign({}, options, { ref: instanceRef, onExited: function () { return unmountComponentAtNode(el); } }))), el);""",
    """    var el = document.createElement("div");
    var instanceRef = React.createRef();
    var root = ReactDOM.createRoot(el); // [TDAI patch] React 18 createRoot
    root.render(React.createElement(ConfigProvider, null,
        React.createElement(ModalShow, __assign({}, options, { ref: instanceRef, onExited: function () { return root.unmount(); } }))));""",
)])

# ── 4. Space 组件单参 render（forwardRef 警告的真凶）──────────────────────
# Space 直接用 forwardRef（不走 forwardRefWithStatics 包装器），render 只声明了
# props 一个参数 → React 18 "accept exactly two parameters" 警告。
# 修复：补第二参 ref 并真正转发到根 div（原实现 ref 被丢弃，属库 bug）。
patch("space/Space.js", [
    (
        """export var Space = forwardRef(function Space(_a) {
    var _b;
    var _c = _a.size""",
        """export var Space = forwardRef(function Space(_a, ref) { // [TDAI patch] 补第二参 ref
    var _b;
    var _c = _a.size""",
    ),
    (
        """    return (React.createElement("div", { className: classList, style: __assign({}, gapStyle) }, nodes));""",
        """    // [TDAI patch] 转发 ref 到根节点（原实现丢弃 ref）
    return (React.createElement("div", { ref: ref, className: classList, style: __assign({}, gapStyle) }, nodes));""",
    ),
])

# ── 5. BaseTransition：给 react-transition-group 传 nodeRef ────────────────
# rtg 4.x 的 Transition 在未传 nodeRef 时内部 findDOMNode(this) → React 18
# 双重弃用警告。BaseTransition 的 children 是 DOM 元素（各 Transition 变体均
# 直接渲染 div），可安全挂 ref 并以 nodeRef 传入 CSSTransition。
patch("transition/BaseTransition.js", [
    (
        """import React, { useRef } from "react";
import { CSSTransition } from "react-transition-group";
import { noop } from "../_util/noop";""",
        """import React, { useRef } from "react";
import { CSSTransition } from "react-transition-group";
import { noop } from "../_util/noop";
import { mergeRefs } from "../_util/merge-refs";
// [TDAI patch] 判断能否安全给 children 挂 ref（与 DomRef 补丁同款守卫）
var ForwardRefSymbol = typeof Symbol === "function" ? Symbol.for("react.forward_ref") : 0xead0;
var MemoSymbol = typeof Symbol === "function" ? Symbol.for("react.memo") : 0xead3;
function canTakeRef(type) {
    if (typeof type === "string")
        return true;
    if (!type)
        return false;
    if (type.$$typeof === ForwardRefSymbol)
        return true;
    if (type.$$typeof === MemoSymbol)
        return canTakeRef(type.type);
    if (typeof type === "function" && type.prototype && type.prototype.isReactComponent)
        return true;
    return false;
}""",
    ),
    (
        """    // 离场时保持 children 不变
    var childrenRef = useRef(null);""",
        """    // 离场时保持 children 不变
    var childrenRef = useRef(null);
    // [TDAI patch] rtg nodeRef：DOM 元素子节点时挂 ref 消除 findDOMNode
    var nodeRef = useRef(null);
    var canRef = React.isValidElement(children) && canTakeRef(children.type);
    var childWithRef = canRef
        ? React.cloneElement(children, { ref: mergeRefs(children.ref, nodeRef) })
        : children;""",
    ),
    # 离场保持的也必须是挂了 nodeRef 的元素，否则 ref 被卸下 → nodeRef.current 变 null
    (
        """            childrenRef.current = children;
            onExit.apply(void 0, __spread(args));""",
        """            childrenRef.current = childWithRef; // [TDAI patch] 保持带 ref 版本
            onExit.apply(void 0, __spread(args));""",
    ),
    (
        """    return (React.createElement(CSSTransition, __assign({}, props, { in: enter, onEnter: function () {""",
        """    return (React.createElement(CSSTransition, __assign({}, props, { in: enter, nodeRef: canRef ? nodeRef : undefined, onEnter: function () {""",
    ),
    (
        """        } }), childrenRef.current || children));""",
        """        } }), childrenRef.current || childWithRef));""",
    ),
])

print("tea-component React18 补丁完成。")
