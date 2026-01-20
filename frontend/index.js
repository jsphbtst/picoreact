import PicoReact, { useState, useEffect } from './packages/pico-react.js'
import PicoReactDOM from './packages/pico-react-dom.js'

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
          PicoReact.createElement('p', {
            textContent: `Div child: ${inputValue}-1`
          }),
          PicoReact.createElement('p', {
            textContent: `Div child: ${inputValue}-2`
          })
        ]
      }),
      PicoReact.createElement(Counter),
      PicoReact.createElement(Header, { variant: 'h2', textContent: '[bottom text]' })
    ]
  })
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found.')
}

const root = PicoReactDOM.createRoot(rootElement)
root.render(App)
