/**
 * RenderContext: Single source of truth for all render-time state.
 *
 * Instead of scattered module-level variables, all implicit state lives here.
 * When you're confused about "what's the current fiber?", look here.
 *
 * State:
 *   - fiber: The component currently being rendered (for hooks to access)
 *   - root: The root object (for setState to trigger rerenders)
 *   - childCursor: Position in fiber tree during rerender traversal
 */
export const RenderContext = {
  fiber: null,
  root: null,
  childCursor: null,

  setFiber(fiber) {
    this.fiber = fiber
  },

  setRoot(root) {
    this.root = root
  },

  beginRerender(rootFiber) {
    this.fiber = rootFiber
    this.childCursor = rootFiber.child
  },

  /**
   * Scoped child traversal - handles the save/restore pattern cleanly.
   *
   * Before (easy to mess up):
   *   const prev = currentChildFiber
   *   currentChildFiber = fiber.child
   *   // ... recurse ...
   *   currentChildFiber = prev
   *
   * After:
   *   RenderContext.withChildScope(fiber.child, () => {
   *     // ... recurse ...
   *   })
   */
  withChildScope(newCursor, fn) {
    const prev = this.childCursor

    this.childCursor = newCursor

    try {
      return fn()
    } finally {
      // Restore even if a component throws mid-render, so the next
      // rerender doesn't walk a corrupted cursor - J
      this.childCursor = prev
    }
  },

  /**
   * Advance the child cursor to the next sibling.
   * Used when reusing fibers during rerender.
   */
  advanceChildCursor() {
    if (this.childCursor) {
      this.childCursor = this.childCursor.sibling
    }
  },

  /**
   * Get current child cursor (for fiber reuse checks during rerender)
   */
  getChildCursor() {
    return this.childCursor
  }
}
