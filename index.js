const TEXT_ELEMENT = 'TEXT_ELEMENT'
function createElement(type, props, ...children) {
  props.children = []
    .concat(children)
    .filter((child != null) & (child != false))
    .map(child => (child instanceof Object ? child : createTextElement(child)))
  return { type, props }
}
function createTextElement(value) {
  return createElement(TEXT_ELEMENT, { nodeValue: value })
}

/* 
  ReactDOM.render
 */

let rootInstance = null
function render(element, parentDom) {
  const prevInstance = rootInstance

  const nextInstance = reconcile(parentDom, prevInstance, element)

  rootInstance = nextInstance
}

function instantiate(element) {
  const type = element.type
  const isDomElement = typeof type === 'string'
  const isClassElement = !!(type.prototype && type.prototype.isReactComponent)

  if (isDomElement) {
    const isTextElement = type === TEXT_ELEMENT
    const dom = isTextElement
      ? document.createTextNode('')
      : document.createElement(type)

    //
    updateDomProperties(dom, [], element.props)

    const children = element.children || []
    const childInstances = children.map(instantiate)
    const childDoms = childInstances.map(childInstance => childInstance.dom)
    childDoms.forEach(childDom => dom.appendChild(childDom))
    const instance = { element, dom, childInstances }
    return instance
  } else if (isClassElement) {
    const instance = {}
    const publicInstance = createPublicInstance(element, instance)
    const childElement = publicInstance.render()
    const childInstance = instantiate(childElement)
    Object.assign(instance, {
      dom: childInstance.dom,
      element,
      childInstance,
      publicInstance
    })
    return instance
  } else {
    // functional component
    const childElement = type(element.props)
    const childInstance = instantiate(childElement)
    const instance = {
      dom: childInstance.dom,
      element,
      childInstance,
      fn: type
    }
    return instance
  }
}

function createPublicInstance(element, instance) {
  const { type, props } = element
  const publicInstance = new type(props)
  publicInstance.__internalInstance = instance
  return publicInstance
}

function updateDomProperties(dom, prevProps, nextProps) {
  const isEvent = name => name.startsWith('on')
  const isAttribute = name => !isEvent(name) && name !== 'children'

  Object.keys(prevProps).forEach(name => {
    if (isEvent(name)) {
      const eventType = name.substring(2).toLowerCase()
      dom.removeEventListener(eventType, prevProps[name])
    } else if (isAttribute(name)) {
      dom[name] = null
    }
  })

  Object.keys(nextProps).forEach(name => {
    if (isEvent(name)) {
      const eventType = name.substring(2).toLowerCase()
      dom.addEventListener(eventType, nextProps[name])
    } else if (isAttribute(name)) {
      dom[name] = nextProps[name]
    }
  })
}

function reconcile(parentDom, prevInstance, element) {
  if (prevInstance === null) {
    const instance = instantiate(element)
    if (
      instance.publicInstance &&
      typeof instance.publicInstance.componentWillMount === 'function'
    ) {
      instance.publicInstance.componentWillMount()
    }
    parentDom.appendChild(instance.dom)
    if (
      instance.publicInstance &&
      typeof instance.publicInstance.componentDidMount === 'function'
    ) {
      instance.publicInstance.componentDidMount()
    }
    return instance
  }
  if (element === null) {
    if (
      prevInstance.publicInstance &&
      typeof prevInstance.publicInstance.componentWillUnmount === 'function'
    ) {
      prevInstance.publicInstance.componentWillUnmount()
    }
    parentDom.removeChild(prevInstance.dom)
    return null
  }
  if (prevInstance.element.type !== element.type) {
    const instance = instantiate(element)
    if (
      instance.publicInstance &&
      typeof instance.publicInstance.componentWillMount === 'function'
    ) {
      instance.publicInstance.componentWillMount()
    }
    parentDom.replaceChild(instance.dom, prevInstance.dom)
    if (
      instance.publicInstance &&
      typeof instance.publicInstance.componentDidMount === 'function'
    ) {
      instance.publicInstance.componentDidMount()
    }
    return instance
  }

  if (element.type === 'string') {
    updateDomProperties(parentDom, prevInstance.element.props, element.props)
    prevInstance.childInstances = reconcileChildren(prevInstance, element)
    prevInstance.element = element
    return prevInstance
  }

  if (
    prevInstance.publicInstance.shouldComponentUpdate &&
    typeof prevInstance.publicInstance.shouldComponentUpdate === 'function'
  ) {
    if (!prevInstance.publicInstance.shouldComponentUpdate()) return

    let newElement
    if (prevInstance.publicInstance) {
      // class component
      newElement = prevInstance.publicInstance.render()
    } else {
      // functional component
      newElement = prevInstance.fn(element.props)
    }
    const oldChildInstance = prevInstance.childInstance
    const newChildInstance = reconcile(parentDom, oldChildInstance, newElement)
    if (
      prevInstance.publicInstance.componentDidUpdate &&
      typeof prevInstance.publicInstance.componentDidUpdate === 'function'
    ) {
      prevInstance.publicInstance.componentDidUpdate()
    }
    prevInstance.dom = newChildInstance.dom
    prevInstance.childInstance = newChildInstance
    prevInstance.element = element
    return prevInstance
  }
}

function reconcileChildren(instance, element) {
  const { childInstances, dom } = instance
  const newChildElements = element.props.children || []
  const count = Math.max(childInstances.length, newChildElements.length)

  let newChildInstances = []
  for (let i = 0; i < count; i++) {
    newChildInstances[i] = reconcile(
      dom,
      childInstances[i],
      newChildElements[i]
    )
  }
  return newChildInstances.filter(instance => instance !== null)
}

class Component {
  constructor(props) {
    this.props = props
    this.state = {}
  }

  setState(state) {
    this.state = { ...this.state, state }
    const internalInstance = this.__internalInstance
    const parentDom = internalInstance.dom.parentNode
    const element = internalInstance.element
    reconcile(parentDom, internalInstance, element)
  }
}

/* 
  <div id="div1">
    <h3 name="h3">Test</h3>
  </div>
 */
const treeData = {
  type: 'div',
  props: {
    id: 'div1',
    className: 'top-level',
    children: [
      {
        type: 'h3',
        props: {
          name: 'h3',
          children: [
            {
              type: 'TEXT_ELEMENT',
              props: {
                children: [],
                nodeValue: 'Webpack'
              }
            }
          ]
        }
      },
      {
        type: 'span',
        props: {
          className: 'desc',
          children: [
            {
              type: 'TEXT_ELEMENT'
            }
          ]
        }
      }
    ]
  }
}

const instance = instantiate(treeData)
// document.getElementById('app').appendChild(app)

console.log(instance)

function getDOMFromVirtualDOM(tree) {
  const type = tree.type
  const dom = document.createElement(type)
  const children = tree.props.children
  if (typeof children === 'string') {
    const textNode = document.createTextNode(children)
    dom.appendChild(textNode)
    return dom
  } else if (Array.isArray(children)) {
    const nodes = children.map(getDOMFromVirtualDOM)
    nodes.forEach(node => dom.appendChild(node))
  } else {
    const d = getDOMFromVirtualDOM(children)
    dom.appendChild(d)
  }
  return dom
}
