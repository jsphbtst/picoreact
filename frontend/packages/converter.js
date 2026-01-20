import { noop } from './utils.js'
import { SUPPORTED_ELEMENTS } from './v-dom.js'

export function convert(node) {
  if (node.isCustomComponent()) {
    throw new Error('Cannot convert unresolved custom component to DOM')
  }

  const el = document.createElement(node.elementType)
  const hasChildren = !!node.props.children

  switch (node.elementType) {
    case SUPPORTED_ELEMENTS.DIV: {
      el.textContent = node.props.textContent || ''

      if (hasChildren) {
        const childElements = node.props.children.map(convert)
        el.append(...childElements)
      }

      break
    }

    case SUPPORTED_ELEMENTS.H1:
    case SUPPORTED_ELEMENTS.H2: {
      el.textContent = node.props.textContent || ''
      break
    }

    case SUPPORTED_ELEMENTS.P: {
      el.textContent = node.props.textContent || ''
      break
    }

    case SUPPORTED_ELEMENTS.INPUT: {
      el.id = node.props.id || 'abcd' // TODO: implement random hasher here
      el.value = node.props.value || ''
      el.oninput = node.props.oninput || undefined
      break
    }

    case SUPPORTED_ELEMENTS.BUTTON: {
      el.innerText = node.props.innerText || ''
      el.onclick = node.props.onclick || noop
      break
    }

    default:
      break
  }

  return el
}
