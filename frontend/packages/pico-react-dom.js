import { convert } from './converter.js'
import { diffVDOM } from './pico-react-reconciler.js'
import { Fiber, runEffects, setRoot, setCurrentFiber } from './pico-react.js'
import { RenderContext } from './render-context.js'

function renderHostElement(vdomNode, parentFiber, isRerender) {
  if (vdomNode.props?.children) {
    vdomNode.props.children = vdomNode.props.children.map(child =>
      renderVDOM(child, parentFiber, isRerender)
    )
  }
  return vdomNode
}

function resolveOrCreateFiber(vdomNode, parentFiber, isRerender) {
  const componentFn = vdomNode.elementType
  const props = vdomNode.props || {}
  const cursor = RenderContext.getChildCursor()

  // Rerender path: reuse existing fiber if component type matches - J
  if (isRerender && cursor?.component === componentFn) {
    cursor.props = props
    RenderContext.advanceChildCursor()
    return cursor
  }

  return new Fiber(componentFn, props, parentFiber)
}

function prepareForRender(fiber) {
  setCurrentFiber(fiber)
  fiber.resetHookIndex()
  fiber.resetEffectIndex()
}

function linkFiberToParent(fiber, parentFiber) {
  if (!parentFiber) {
    return
  }

  // Check if already linked (happens during rerender with reused fibers) - J
  let child = parentFiber.child

  while (child) {
    if (child === fiber) {
      return
    }

    child = child.sibling
  }

  // Append to parent's child list - J
  if (!parentFiber.child) {
    parentFiber.child = fiber
  } else {
    let lastSibling = parentFiber.child

    while (lastSibling.sibling) {
      lastSibling = lastSibling.sibling
    }

    lastSibling.sibling = fiber
  }
}

export function renderVDOM(vdomNode, parentFiber = null, isRerender = false) {
  if (!vdomNode.isCustomComponent()) {
    return renderHostElement(vdomNode, parentFiber, isRerender)
  }

  const fiber = resolveOrCreateFiber(vdomNode, parentFiber, isRerender)

  prepareForRender(fiber)
  const rendered = fiber.component(fiber.props)

  linkFiberToParent(fiber, parentFiber)

  return RenderContext.withChildScope(fiber.child, () => renderVDOM(rendered, fiber, isRerender))
}

class Root {
  constructor(domNode) {
    this.domNode = domNode
    this.vDOM = null
    this.elements = null
    this.CurrentComponent = null
    this.rootFiber = null
  }

  render(Component) {
    if (this.elements !== null) {
      throw new Error(
        'Cannot call render() multiple times on the same root. Feature currently not supported.'
      )
    }

    this.CurrentComponent = Component
    this.rootFiber = new Fiber(Component, {}, null)

    setCurrentFiber(this.rootFiber)
    this.rootFiber.resetHookIndex()
    this.rootFiber.resetEffectIndex()

    const rawVDOM = Component()
    this.vDOM = renderVDOM(rawVDOM, this.rootFiber, false)

    this.elements = convert(this.vDOM)
    this.domNode.replaceChildren(this.elements)

    runEffects(this.rootFiber)
  }

  rerender() {
    if (!this.CurrentComponent || !this.rootFiber) {
      return
    }

    // Set up context for rerender pass - J
    RenderContext.beginRerender(this.rootFiber)
    this.rootFiber.resetHookIndex()
    this.rootFiber.resetEffectIndex()

    const prevVDOM = this.vDOM

    const rawNewVDOM = this.CurrentComponent()
    const newVDOM = renderVDOM(rawNewVDOM, this.rootFiber, true)
    this.vDOM = diffVDOM(this.elements, prevVDOM, newVDOM)

    runEffects(this.rootFiber)
  }
}

export function createRoot(domNode) {
  const root = new Root(domNode)
  setRoot(root)
  return root
}

const PicoReactDOM = { createRoot }

export default PicoReactDOM
