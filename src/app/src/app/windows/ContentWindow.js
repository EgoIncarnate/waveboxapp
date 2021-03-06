const WaveboxWindow = require('./WaveboxWindow')
const { shell } = require('electron')
const querystring = require('querystring')
const path = require('path')
const mouseFB = process.platform === 'linux' ? require('mouse-forward-back') : undefined

const CONTENT_DIR = path.resolve(path.join(__dirname, '/../../../scenes/content'))
const SAFE_CONFIG_KEYS = [
  'width',
  'height',
  'x',
  'y',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'resizable',
  'title'
]
const COPY_WEBVIEW_WEB_PREFERENCES_KEYS = [
  'guestInstanceId',
  'openerId',
  'partition'
]
const COPY_WEBVIEW_PROP_KEYS = [
  'partition'
]

class ContentWindow extends WaveboxWindow {
  /* ****************************************************************************/
  // Creation
  /* ****************************************************************************/

  /**
  * Generates the url for the window
  * @param url: the url to load
  * @param partition: the partition for the webview
  * @return a fully qualified url to give to the window object
  */
  generateWindowUrl (url, partition) {
    const params = querystring.stringify({
      url: url,
      partition: partition
    })
    return `file://${path.join(CONTENT_DIR, 'content.html')}?${params}`
  }

  /**
  * Starts the window
  * @param parentWindow: the parent window this spawned from
  * @param url: the start url
  * @param partition: the partition to supply to the webview
  * @param windowPreferences={}: the configuration for the window
  * @param webPreferences={}: the web preferences for the hosted child
  */
  start (parentWindow, url, partition, windowPreferences = {}, webPreferences = {}) {
    // Store some local vars
    this.guestWebPreferences = Object.assign({}, webPreferences, { partition: partition })

    // Grab the position from the parent window
    const copyPosition = !parentWindow.isFullScreen() && !parentWindow.isMaximized()
    const parentSizing = copyPosition ? (() => {
      const position = parentWindow.getPosition()
      const size = parentWindow.getSize()
      return {
        x: position[0] + 20,
        y: position[1] + 20,
        width: size[0],
        height: size[1]
      }
    })() : undefined

    // Generate the full windowPreferences
    const fullWindowPreferences = Object.assign(
      {
        minWidth: 300,
        minHeight: 300,
        fullscreenable: true,
        title: 'Wavebox',
        backgroundColor: '#f2f2f2',
        webPreferences: {
          nodeIntegration: true
        }
      },
      parentSizing,
      SAFE_CONFIG_KEYS.reduce((acc, k) => { // These keys can come from a hosted page, so don't copy anything like webPreferences
        if (windowPreferences[k] !== undefined) {
          acc[k] = windowPreferences[k]
        }
        return acc
      }, {})
    )

    // Start the browser window
    return super.start(this.generateWindowUrl(url, partition), fullWindowPreferences)
  }

  /**
  * Creates and launches the window
  * @arguments: passed through to super()
  */
  createWindow () {
    super.createWindow.apply(this, Array.from(arguments))

    // New window handling
    this.window.webContents.on('new-window', (evt, url) => {
      evt.preventDefault()
      shell.openExternal(url)
    })

    // Patch through options into webview
    this.window.webContents.on('will-attach-webview', (evt, webPreferences, properties) => {
      COPY_WEBVIEW_WEB_PREFERENCES_KEYS.forEach((k) => {
        if (this.guestWebPreferences[k] !== undefined) {
          webPreferences[k] = this.guestWebPreferences[k]
        }
      })
      COPY_WEBVIEW_PROP_KEYS.forEach((k) => {
        if (this.guestWebPreferences[k] !== undefined) {
          properties[k] = this.guestWebPreferences[k]
        }
      })
    })

    // Mouse navigation
    if (process.platform === 'win32') {
      this.window.on('app-command', (evt, cmd) => {
        switch (cmd) {
          case 'browser-backward': this.navigateBack(); break
          case 'browser-forward': this.navigateForward(); break
        }
      })
    } else if (process.platform === 'linux') {
      // Re-register the event on focus as newly focused windows will overwrite this
      this.registerLinuxMouseNavigation()
      this.window.on('focus', () => {
        this.registerLinuxMouseNavigation()
      })
    }
  }

  /**
  * Binds the listeners for mouse navigation on linux
  */
  registerLinuxMouseNavigation () {
    mouseFB.register((btn) => {
      switch (btn) {
        case 'back': this.navigateBack(); break
        case 'forward': this.navigateForward(); break
      }
    }, this.window.getNativeWindowHandle())
  }

  /* ****************************************************************************/
  // Actions
  /* ****************************************************************************/

  /**
  * Reloads the webview content
  * @return this
  */
  reload () {
    this.window.webContents.send('reload-webview', {})
    return this
  }

  /**
  * Navigates the content window backwards
  * @return this
  */
  navigateBack () {
    this.window.webContents.send('navigate-webview-back', {})
    return this
  }

  /**
  * Navigates the content window forwards
  * @return this
  */
  navigateForward () {
    this.window.webContents.send('navigate-webview-forward', {})
    return this
  }
}

module.exports = ContentWindow
