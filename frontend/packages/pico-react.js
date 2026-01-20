import { VDOMNode, SUPPORTED_ELEMENTS } from './v-dom.js'
import { RenderContext } from './render-context.js'

export class Fiber {
  constructor(component, props, parent = null) {
    this.component = component
    this.props = props
    this.hooks = []
    this.effects = []
    this.hookIndex = 0
    this.effectIndex = 0
    this.parent = parent // Parent fiber for tree traversal
    this.child = null // First child fiber
    this.sibling = null // Next sibling fiber
  }

  resetHookIndex() {
    this.hookIndex = 0
  }

  resetEffectIndex() {
    this.effectIndex = 0
  }
}

export function createElement(elementType, props = {}) {
  if (typeof elementType === 'string') {
    if (!Object.values(SUPPORTED_ELEMENTS).includes(elementType)) {
      throw new Error(`Unsupported host element: ${elementType}`)
    }

    return new VDOMNode(elementType, props)
  }

  if (typeof elementType === 'function') {
    return new VDOMNode(elementType, props)
  }

  throw new Error(`Invalid element type: ${typeof elementType}`)
}

// These delegate to RenderContext - kept for API compatibility - J
export function setCurrentFiber(fiber) {
  RenderContext.setFiber(fiber)
}

export function getCurrentFiber() {
  return RenderContext.fiber
}

export function setRoot(root) {
  RenderContext.setRoot(root)
}

export function useState(initialState) {
  const fiber = RenderContext.fiber
  const root = RenderContext.root
  const index = fiber.hookIndex++

  if (fiber.hooks[index] === undefined) {
    fiber.hooks[index] = initialState
  }

  // Closure captures fiber and root at hook creation time - J
  const setState = arg => {
    const value = typeof arg === 'function' ? arg(fiber.hooks[index]) : arg
    fiber.hooks[index] = value
    root.rerender()
  }

  return [fiber.hooks[index], setState]
}

function areUseEffectDepsEqual(prevDeps, nextDeps) {
  if (prevDeps === null || nextDeps === null) {
    return false
  }

  if (prevDeps.length !== nextDeps.length) {
    return false
  }

  for (let i = 0; i < prevDeps.length; i++) {
    if (prevDeps[i] !== nextDeps[i]) {
      return false
    }
  }

  return true
}

export function useEffect(callback, deps) {
  const fiber = RenderContext.fiber
  const index = fiber.effectIndex++

  const prevEffect = fiber.effects[index]
  let shouldRun = false

  if (!prevEffect) {
    shouldRun = true // First render - always run
  } else if (deps === undefined) {
    shouldRun = true // No deps array - run every render
  } else if (prevEffect.deps === undefined) {
    shouldRun = true // Weird edge case: previous had no deps, current has deps
  } else if (!areUseEffectDepsEqual(prevEffect.deps, deps)) {
    shouldRun = true // Dependencies changed
  }

  fiber.effects[index] = { callback, deps, cleanup: prevEffect?.cleanup, shouldRun }
}

export function runEffects(fiber) {
  if (!fiber) return

  for (let idx = 0; idx < fiber.effects.length; idx++) {
    const effect = fiber.effects[idx]

    if (effect.shouldRun) {
      effect.cleanup?.()

      const cleanup = effect.callback()

      effect.cleanup = cleanup
      effect.shouldRun = false
    }
  }

  runEffects(fiber.child)
  runEffects(fiber.sibling)
}

const PicoReact = {
  useState,
  useEffect,
  createElement
}

export default PicoReact
