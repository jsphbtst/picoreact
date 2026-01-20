export const SUPPORTED_ELEMENTS = {
  DIV: 'div',
  P: 'p',
  H1: 'h1',
  H2: 'h2',
  INPUT: 'input',
  BUTTON: 'button'
}

export class VDOMNode {
  elementType
  props

  constructor(elementType, props) {
    this.elementType = elementType
    this.props = props
  }

  isCustomComponent() {
    return typeof this.elementType === 'function'
  }
}
