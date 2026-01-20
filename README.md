# PicoReact

This is a minimal React implementation called `PicoReact`. This was built from scratch for my own personal learning of React's internals.

---

## Motivation

Oftentimes, React can feel like magic—components update automatically, the UI stays in sync with state, and somehow it's all performant. **PicoReact** is my attempt to understand React by rebuilding its core concepts from first principles. Concepts I learned range from the virtual DOM representation, reconciliation (diffing algorithm), the fiber architecture (per-component state isolation, mostly), hooks, component rendering and re-rendering, and support for custom components with props and children.

If it wasn't obvious enough, this is not meant for production use... this was all meant for learning.

---

## Core concepts

### Virtual DOM

**Problem:** Direct DOM manipulation is slow. Every time you change the DOM, the browser has to recalculate styles, layout, and repaint. If you're updating frequently, this can get expensive rather quickly.

**Solution:** Keep a lightweight JavaScript representation of the UI tree (the "Virtual DOM"). When state changes:

1. Create a new virtual tree
2. Compare it with the old tree (diffing)
3. Calculate the minimal set of real DOM changes needed
4. Apply only those changes

**In PicoReact:**

```javascript
// frontend/packages/v-dom.js
class VDOMNode {
  constructor(elementType, props) {
    this.elementType = elementType // 'div', 'button', 'h1', 'h2', 'p', 'input', or a component function
    this.props = props // { textContent, onclick, children, etc. }
  }

  isCustomComponent() {
    return typeof this.elementType === 'function' // Check if it's a custom component
  }
}
```

### Reconciliation

**Problem:** How do you figure out what changed between two trees efficiently?

**Solution:** Walk both trees simultaneously, comparing nodes:

- If node types match → update properties that changed
- For children → compare by index and handle additions/removals (simple approach, React uses keys for optimization)

**In PicoReact:**

```javascript
// frontend/packages/pico-react-reconciler.js
export function diffVDOM(element, prevVDOM, newVDOM) {
  diffElement(element, prevVDOM, newVDOM)
  return newVDOM
}
```

The reconciler updates real DOM nodes only when properties actually changed:

```javascript
// frontend/packages/pico-react-reconciler.js
if (newElement.elementType === SUPPORTED_ELEMENTS.H1) {
  if (prevElement.props.textContent !== newElement.props.textContent) {
    domElement.textContent = newElement.props.textContent // Only update if different
  }
}
```

For child elements, the reconciler handles three cases:

```javascript
// frontend/packages/pico-react-reconciler.js
function diffChildren(parentElement, prevChildren, newChildren) {
  const maxLength = Math.max(prevChildren.length, newChildren.length)

  for (let i = 0; i < maxLength; i++) {
    const prevChild = prevChildren[i]
    const newChild = newChildren[i]
    const existingChild = parentElement.children[i]

    if (!newChild && existingChild) {
      existingChild.remove() // Child was removed
    } else if (!prevChild && newChild) {
      parentElement.append(convert(newChild)) // Child was added
    } else if (prevChild.elementType === newChild.elementType) {
      diffElement(existingChild, prevChild, newChild) // Same type: update
    } else {
      existingChild.replaceWith(convert(newChild)) // Different type: replace
    }
  }
}
```

**Input optimization:** For input elements, the reconciler skips value updates when the input is focused to prevent cursor jumping:

```javascript
if (newElement.elementType === SUPPORTED_ELEMENTS.INPUT) {
  if (document.activeElement !== domElement) {
    domElement.value = newElement.props.value // Only update if not focused
  }
}
```

**Note:** Component resolution (calling component functions to expand custom components into host elements) happens in `renderVDOM` before reconciliation. This separation keeps the reconciler focused solely on diffing resolved VDOM trees. The `convert()` function in `converter.js` transforms resolved VDOM nodes into actual DOM elements.

### Hooks & Fiber Architecture

**Problem:** How do you add state to function components? Functions are stateless by nature—they execute and forget. Additionally, how do you ensure each component instance has its own isolated state when you have nested components?

**Solution:** Use a **Fiber architecture** where each component instance gets its own "fiber" object that stores hooks and maintains tree relationships. Hook state is stored per-fiber, indexed by call order within that fiber.

**In PicoReact:**

```javascript
// frontend/packages/pico-react.js
export class Fiber {
  constructor(component, props, parent = null) {
    this.component = component // Component function
    this.props = props // Props object
    this.hooks = [] // Per-instance hook storage
    this.effects = [] // Per-instance effect storage
    this.hookIndex = 0 // Current hook index during render
    this.effectIndex = 0 // Current effect index during render
    this.parent = parent // Parent fiber for tree traversal
    this.child = null // First child fiber
    this.sibling = null // Next sibling fiber
  }
}

export function useState(initialState) {
  const fiber = getCurrentFiber() // Get the currently rendering fiber
  const index = fiber.hookIndex++ // Use fiber's hook index

  if (fiber.hooks[index] === undefined) {
    fiber.hooks[index] = initialState // First render: initialize
  }

  const setState = arg => {
    const value = typeof arg === 'function' ? arg(fiber.hooks[index]) : arg
    fiber.hooks[index] = value
    currentRoot.rerender() // Trigger re-render when state changes
  }

  return [fiber.hooks[index], setState]
}
```

Without fibers, all components would share the same global `hooks` array. With fibers, each component instance maintains its own hook storage, enabling proper state isolation for nested components.

Moreover, Hooks are stored in an array and accessed by index. If you call hooks conditionally, the indices get out of sync and you'll read the wrong state. This is why React has the "Rules of Hooks."

**useEffect Implementation:**

```javascript
// frontend/packages/pico-react.js
export function useEffect(callback, deps) {
  const fiber = getCurrentFiber() // Get the currently rendering fiber
  const index = fiber.effectIndex++ // Use fiber's effect index

  const prevEffect = fiber.effects[index]
  let shouldRun = false

  if (!prevEffect) {
    shouldRun = true // First render: always run
  } else if (deps === undefined) {
    shouldRun = true // No deps: run every render
  } else if (!areUseEffectDepsEqual(prevEffect.deps, deps)) {
    shouldRun = true // Dependencies changed: run
  }

  fiber.effects[index] = { callback, deps, cleanup: prevEffect?.cleanup, shouldRun }
}
```

Effects are queued during render in the fiber's `effects` array, then executed after the DOM updates by traversing the fiber tree:

```javascript
export function runEffects(fiber) {
  if (!fiber) return

  // Run effects for this fiber
  for (let effect of fiber.effects) {
    if (effect.shouldRun) {
      effect.cleanup?.() // Run cleanup from previous render
      effect.cleanup = effect.callback() // Run effect and store new cleanup
      effect.shouldRun = false
    }
  }

  // Recursively run effects for children and siblings
  runEffects(fiber.child)
  runEffects(fiber.sibling)
}
```

### Custom Components

**Problem:** How do you support reusable, user-defined components (not just host elements like `div` or `button`)?

**Solution:** Allow `createElement` to accept both strings (host elements) and functions (custom components). Custom components need to be "resolved" by calling them with their props to get the actual VDOM tree.

**In PicoReact:**

```javascript
// frontend/packages/pico-react.js
export function createElement(elementType, props) {
  // Host element (div, button, etc.)
  if (typeof elementType === 'string') {
    if (!Object.values(SUPPORTED_ELEMENTS).includes(elementType)) {
      throw new Error(`Unsupported host element: ${elementType}`)
    }

    return new VDOMNode(elementType, props)
  }

  // Custom component
  if (typeof elementType === 'function') {
    return new VDOMNode(elementType, props)
  }

  throw new Error(`Invalid element type: ${typeof elementType}`)
}
```

**Component Resolution & Fiber Reuse:**

Custom components are resolved recursively before rendering to the DOM. During re-renders, fibers are reused to preserve hook state:

```javascript
// frontend/packages/pico-react-dom.js
export function renderVDOM(vdomNode, parentFiber = null, isRerender = false) {
  // Base case: host element
  if (!vdomNode.isCustomComponent()) {
    if (vdomNode.props?.children) {
      vdomNode.props.children = vdomNode.props.children.map(child =>
        renderVDOM(child, parentFiber, isRerender)
      )
    }
    return vdomNode
  }

  // Recursive case: custom component
  const componentFn = vdomNode.elementType
  const props = vdomNode.props || {}

  // Try to reuse existing fiber during re-render
  let fiber
  if (isRerender && currentChildFiber && currentChildFiber.component === componentFn) {
    fiber = currentChildFiber // Reuse existing fiber (preserves hooks!)
    fiber.props = props // Update props
    currentChildFiber = currentChildFiber.sibling // Move to next sibling
  } else {
    fiber = new Fiber(componentFn, props, parentFiber) // Create new fiber
  }

  setCurrentFiber(fiber)
  fiber.resetHookIndex()
  fiber.resetEffectIndex()

  // Call the component function
  const rendered = componentFn(props)

  // Link fiber into tree (ensures parent-child-sibling relationships)
  if (parentFiber && !isAlreadyLinked(parentFiber, fiber)) {
    linkFiberToParent(parentFiber, fiber)
  }

  // Recursively resolve
  return renderVDOM(rendered, fiber, isRerender)
}
```

**How Fiber Reuse Works:**

1. **Initial render:** Create new fibers for all components, build fiber tree
2. **Re-render:** Walk the existing fiber tree (`currentChildFiber`) in parallel with new VDOM tree
3. **Matching:** If component function references match (using `===`), reuse the fiber (preserving `hooks[]` array)
4. **State preservation:** Since the fiber is reused, `fiber.hooks[]` contains the state from the previous render

**Limitation:** The current implementation uses simple pointer comparison (`currentChildFiber.component === componentFn`), which works for single instances but doesn't handle complex scenarios like multiple instances of the same component type at the same level or reordering. React solves this with keys.

This allows component composition with independent state:

```javascript
function Counter() {
  const [count, setCount] = useState(0) // Counter has its own state

  return createElement('div', {
    children: [
      createElement('p', { textContent: `Count: ${count}` }),
      createElement('button', {
        innerText: 'Increment',
        onclick: () => setCount(c => c + 1)
      })
    ]
  })
}

function App() {
  const [name, setName] = useState('Alice') // App has its own state

  return createElement('div', {
    children: [
      createElement(Counter, {}), // First Counter instance
      createElement(Counter, {}), // Second Counter instance (independent state!)
      createElement('input', { value: name, oninput: e => setName(e.target.value) })
    ]
  })
}
```

Each `Counter` instance maintains its own independent state because each has its own fiber with separate hook storage.

---

## Demo

The example app in `frontend/index.js` showcases the core features:

- ✅ Reactive text updates
- ✅ Controlled input field
- ✅ Button click handling
- ✅ useState with functional updates
- ✅ useEffect with dependency tracking
- ✅ Nested children rendering
- ✅ Custom components with props
- ✅ Nested custom components with independent hooks (Fiber architecture)

```javascript
function Header(props) {
  const variant = props.variant || 'h1'
  return PicoReact.createElement(variant, { ...props })
}

function Counter() {
  const [counter, setCounter] = useState(0)

  useEffect(() => {
    console.log('counter', counter)
  }, [counter])

  return PicoReact.createElement('div', {
    children: [
      PicoReact.createElement('p', { textContent: `Counter: ${counter}` }),
      PicoReact.createElement('button', {
        innerText: 'Increment',
        onclick: () => setCounter(prev => prev + 1)
      })
    ]
  })
}

function App() {
  const [inputValue, setInputValue] = useState('Joseph')
  const header = `Hello, ${inputValue}!`

  useEffect(() => {
    console.log('Hello, world!')
  }, [])

  useEffect(() => {
    console.log('inputValue', inputValue)
  }, [inputValue])

  return PicoReact.createElement('div', {
    children: [
      PicoReact.createElement(Header, { variant: 'h1', textContent: header }),
      PicoReact.createElement('input', {
        id: 'input',
        value: inputValue,
        oninput: event => setInputValue(event.target.value || '')
      }),
      PicoReact.createElement('div', {
        children: [
          PicoReact.createElement('p', { textContent: `Div child: ${inputValue}-1` }),
          PicoReact.createElement('p', { textContent: `Div child: ${inputValue}-2` })
        ]
      }),
      PicoReact.createElement(Counter), // Nested component with its own hooks!
      PicoReact.createElement(Header, { variant: 'h2', textContent: '[bottom text]' })
    ]
  })
}
```

---

## Things to still work on

- **Keyed reconciliation** — Use `key` props to track children across renders (prevents unnecessary re-renders when reordering lists)
- **Better fiber matching** — Handle multiple instances of the same component type and reordering
- **Alternate fiber pattern** — Implement React's double-buffering approach with `fiber.alternate` for cleaner state management
- **More hooks** — useRef, useCallback, useMemo, useContext
- **Event delegation** — Attach listeners at root instead of every element
- **Batch updates** — Queue multiple setState calls and render once
- **Error boundaries** — Catch errors in component tree
- **Dev mode warnings** — Detect hook order violations, missing keys, etc.
- **Component lifecycle** — Proper cleanup when components unmount (currently only effect cleanups run)
- **Concurrent rendering** — Time-slicing and prioritization of updates
- **Comprehensive reconciliation** — Handle element type changes at all levels, not just children
