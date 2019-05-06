import marked from 'marked'
import { div } from 'react-hyperscript-helpers'


/**
 * WARNING: Be very careful when using custom renderers because they may override marked's built-in
 * content sanitization.
 * @param {string} children markdown content
 * @param renderers element-specific renderers
 * @param props properties for wraper div
 * @returns {object} div containing rendered markdown
 * @constructor
 */
export const Markdown = ({ children, renderers = {}, ...props }) => {
  const content = marked(children, {
    renderer: Object.assign(new marked.Renderer(), renderers)
  })
  return div({
    className: 'markdown-body', ...props,
    dangerouslySetInnerHTML: { __html: content }
  })
}
export const newWindowLinkRenderer = (href, title, text) => {
  return `<a href="${href}" ${(title ? `title=${title}` : '')} target="_blank">${text}</a>`
}
