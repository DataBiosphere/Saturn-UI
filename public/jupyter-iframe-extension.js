define([
  'base/js/namespace'
], function(
  Jupyter
) {
  function close_notebook() {
    Jupyter.notebook.shutdown_kernel({ confirm: false })
      .then(Window.parent.postMessage('close'), Window.parent.postMessage('close')) // whether it succeeds or not; this mirrors Jupyter's behavior
  }

  function load_ipython_extension() {
    // hide header
    $('#header-container').hide()

    // remove menu items
    $('#new_notebook').remove()
    $('#open_notebook').remove()
    $('#file_menu .divider').first().remove()
    $('#toggle_header').remove()

    // override close menu action
    $('#close_and_halt').on('click', close_notebook)

    // add close button
    $('#menubar-container > div').wrapAll('<div style="max-width: calc(100% - 40px)">')

    $('#menubar-container')
      .css('display', 'flex')
      .append(
        '<style>' +
        '#menubar-close-button { margin-left: 20px; margin-top: -5px; align-self: center; width: 30px; height: 30px; fill: currentColor; flex: none; color: #2691d0; }' +
        '#menubar-close-button:hover { text-decoration: none; color: #5aa6da; }' +
        '</style>',

        '<a href="#" id="menubar-close-button" title="Shutdown this notebook\'s kernel, and close this window">' +
        // times-circle from Clarity
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">' +
        '<path d="M19.61 18l4.86-4.86a1 1 0 0 0-1.41-1.41l-4.86 4.81-4.89-4.89a1 1 0 0 0-1.41 1.41L16.78 18 12 22.72a1 1 0 1 0 1.41 1.41l4.77-4.77 4.74 4.74a1 1 0 0 0 1.41-1.41z"/>' +
        '<path d="M18 34a16 16 0 1 1 16-16 16 16 0 0 1-16 16zm0-30a14 14 0 1 0 14 14A14 14 0 0 0 18 4z"/>' +
        '</svg>' +
        '</a>'
      )

    $('#menubar-close-button').on('click', close_notebook)

    // frequent autosave
    Jupyter.notebook.set_autosave_interval(5000)
  }

  return {
    load_ipython_extension: load_ipython_extension
  }
})
