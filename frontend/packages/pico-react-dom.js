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

export function createRoot(domNode) {
  let vDOM
  let elements
  let CurrentComponent
  let rootFiber = null

  function render(Component) {
    CurrentComponent = Component

    if (elements === undefined) {
      rootFiber = new Fiber(Component, {}, null)
      setCurrentFiber(rootFiber)

      rootFiber.resetHookIndex()
      rootFiber.resetEffectIndex()

      const rawVDOM = Component()
      vDOM = renderVDOM(rawVDOM, rootFiber, false)

      elements = convert(vDOM)
      domNode.replaceChildren(elements)

      runEffects(rootFiber)
    } else {
      throw new Error(
        'Cannot call render() multiple times on the same root. Feature currently not supported.'
      )
    }
  }

  function rerender() {
    if (CurrentComponent && rootFiber) {
      // Set up context for rerender pass - J
      RenderContext.beginRerender(rootFiber)
      rootFiber.resetHookIndex()
      rootFiber.resetEffectIndex()

      let prevVDOM = vDOM

      const rawNewVDOM = CurrentComponent()
      let newVDOM = renderVDOM(rawNewVDOM, rootFiber, true)
      vDOM = diffVDOM(elements, prevVDOM, newVDOM)

      runEffects(rootFiber)
    }
  }

  const root = { render, rerender }

  setRoot(root)
  return root
}

const PicoReactDOM = { createRoot }

export default PicoReactDOM
