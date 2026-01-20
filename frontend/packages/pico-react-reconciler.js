import { SUPPORTED_ELEMENTS } from './v-dom.js'
import { convert } from './converter.js'

export function diffVDOM(element, prevVDOM, newVDOM) {
  diffElement(element, prevVDOM, newVDOM)
  return newVDOM
}

function diffElement(domElement, prevElement, newElement) {
  if (newElement.elementType === SUPPORTED_ELEMENTS.H1) {
    if (prevElement.props.textContent !== newElement.props.textContent) {
      domElement.textContent = newElement.props.textContent
    }
  }

  if (newElement.elementType === SUPPORTED_ELEMENTS.P) {
    if (prevElement.props.textContent !== newElement.props.textContent) {
      domElement.textContent = newElement.props.textContent
    }
  }

  if (newElement.elementType === SUPPORTED_ELEMENTS.DIV) {
    if (prevElement.props.textContent !== newElement.props.textContent) {
      domElement.textContent = newElement.props.textContent
    }

    if (newElement.props.children) {
      diffChildren(domElement, prevElement.props.children, newElement.props.children)
    }
  }

  if (newElement.elementType === SUPPORTED_ELEMENTS.INPUT) {
    if (document.activeElement !== domElement) {
      domElement.value = newElement.props.value
    }

    domElement.oninput = newElement.props.oninput
  }

  if (newElement.elementType === SUPPORTED_ELEMENTS.BUTTON) {
    if (prevElement.props.innerText !== newElement.props.innerText) {
      domElement.innerText = newElement.props.innerText
    }

    domElement.onclick = newElement.props.onclick
  }
}

function diffChildren(parentElement, prevChildren, newChildren) {
  const maxLength = Math.max(prevChildren.length, newChildren.length)

  for (let i = 0; i < maxLength; i++) {
    const prevChild = prevChildren[i]
    const newChild = newChildren[i]
    const existingChild = parentElement.children[i]

    if (!newChild && existingChild) {
      existingChild.remove()
    } else if (!prevChild && newChild) {
      parentElement.append(convert(newChild))
    } else if (prevChild.elementType === newChild.elementType) {
      diffElement(existingChild, prevChild, newChild)
    } else {
      existingChild.replaceWith(convert(newChild))
    }
  }
}
