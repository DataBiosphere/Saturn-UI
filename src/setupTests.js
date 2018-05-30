import { configure, ReactWrapper } from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import 'mutationobserver-shim'
import * as Utils from 'src/libs/utils'


configure({ adapter: new Adapter() })

jest.mock('src/libs/ajax')
jest.mock('src/libs/nav')
jest.mock('src/libs/auth')

window.gapi = {
  load: () => {}
}
window.Element.prototype['insertAdjacentElement'] = () => {} // for custom icons

// Mock dates due to time zone issues
jest.spyOn(Utils, 'makePrettyDate').mockImplementation(() => '***MOCKED DATE***')

ReactWrapper.prototype.testId = function(id) {
  const wrapper = this.find(`[data-test-id='${id}']`)
  const length = wrapper.length

  console.assert(length === 1, `data-test-id '${id}' found ${length} times`)

  return wrapper
}

ReactWrapper.prototype.findIcon = function(shape) {
  return this.find(`[shape="${shape}"]`)
}

ReactWrapper.prototype.click = function() {
  return this.simulate('click')
}
