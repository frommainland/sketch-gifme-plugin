import { setInterval } from 'sketch-polyfill-setinterval'

const gifMeVideoDataKey = 'gif.me.video.data'
const gifMeVideoNameKey = 'gif.me.video.name'

export default function (context) {

  const videoPath = promptForVideoFile(context)
  if (!videoPath) {
    log('No video file selected')
    return
  }
  insertVideo(context, videoPath)
}

function promptForVideoFile (context) {
  const openPanel = NSOpenPanel.openPanel()
  openPanel.setCanChooseFiles(true)
  openPanel.setCanChooseDirectories(false)
  openPanel.setAllowsMultipleSelection(false)
  const clicked = openPanel.runModal()

  if (clicked == NSFileHandlingPanelOKButton) {
    const urls = openPanel.URLs()
    if (urls.count() > 0) {
      return urls[0].path()
    }
  }
}

function insertVideo (context, videoPath, layer, skipSave) {
  const outputDir = exportFrames(videoPath)
  if (!outputDir) {
    log('Failed to export frames')
    return
  }
  log('Exported frames to ' + outputDir)

  const count = NSFileManager
    .defaultManager()
    .contentsOfDirectoryAtPath_error(outputDir, null)
    .count()

  const images = []
  for (let i = 1; i <= count; i++) {
    const imagePath = outputDir + '/' + i + '.jpg'
    images.push(NSImage.alloc().initByReferencingFile(imagePath))
  }

  // if no layer is passed in, get the currently selected layer, or create a new one
  if (!layer) {
    const layers = context.document.selectedLayers().layers()
    layer = layers.count() > 0 ?
      layers[0] :
      createRectangle(context, images[0].size())
  }

  let index = 0

  setInterval(function () {
    const fill = layer.style().fills().firstObject()
    fill.setFillType(4)
    index = (index + 1) % images.length
    fill.setImage(MSImageData.alloc().initWithImage(images[index]))
    fill.setPatternFillType(1)
  }, 40)

  if (!skipSave) {
    storeVideoOnLayer(context, layer, videoPath)
  }
}

function exportFrames (filePath) {
  const outDir = tempDir('frames')

  NSFileManager
    .defaultManager()
    .createDirectoryAtPath_withIntermediateDirectories_attributes_error(
      outDir, true, null, null
    )

  const pattern = outDir + '/%d.jpg'
  const task = NSTask.alloc().init()
  task.setLaunchPath("/usr/local/bin/ffmpeg")
  task.setArguments(["-i", filePath, "-r", "25.0", pattern])
  const outputPipe = NSPipe.pipe()
  task.setStandardOutput(outputPipe)
  task.launch()

  const outputData = outputPipe.fileHandleForReading().readDataToEndOfFile()
  const outputString = NSString.alloc().initWithData_encoding(outputData, NSUTF8StringEncoding)

  return outDir
}

function tempDir (name) {
  name = name || ''
  // FIXME
  var tmp = NSTemporaryDirectory() + 'sketch-video-plugin/' + name + randomInt(9999999) + '/'
  NSFileManager
    .defaultManager()
    .createDirectoryAtPath_withIntermediateDirectories_attributes_error(
      tmp, true, null, null
    )
  return tmp
}

function randomInt (max) {
  return Math.floor(Math.random() * max)
}

function createRectangle (context, nsSize) {
  const scrollOrigin = context.document.currentView().scrollOrigin()
  const contentRect = context.document.currentView().visibleContentRect()
  const width = nsSize.width
  const height = nsSize.height
  const rect = NSMakeRect(
      contentRect.origin.x + (contentRect.size.width - width) / 2,
      contentRect.origin.y + (contentRect.size.height - height) / 2,
      width,
      height
  )
  const shape = MSRectangleShape.alloc().initWithFrame(rect)
  const shapeGroup = MSShapeGroup.shapeWithPath(shape);
  shapeGroup.style().addStylePartOfType(0)
  context.document.currentPage().addLayer(shapeGroup)
  return shapeGroup
}

function storeVideoOnLayer (context, layer, videoPath) {
  let data = NSData.dataWithContentsOfFile(videoPath)
  data = data.base64EncodedDataWithOptions(null)
  data = NSString.alloc().initWithData_encoding(data, NSUTF8StringEncoding)
  context.command.setValue_forKey_onLayer(data, gifMeVideoDataKey, layer)
  const fileName = videoPath.substring(videoPath.lastIndexOf('/') + 1)
  log('Saving video data for ' + fileName + ' on ' + layer)
  context.command.setValue_forKey_onLayer(fileName, gifMeVideoNameKey, layer)
}

export function onOpenDocument (context) {
  // FIXME: For some reason, the child layers are not present when
  // OpenDocument is triggered. So let's wait an arbitrary amount
  // of time before checking for videos.
  // FIXME: note we can't use setTimeout here, or clear the interval, because
  // it kills to COScript after running, which stops the animation.
  let done = false
  setInterval(function () {
    if (!done) {
      const document = context.document || context.actionContext.document
      if (document) {
        const pages = document.pages()
        for (let i = 0; i < pages.count(); i++) {
          const children = pages[i].children()
          for (let j = 0; j < children.count(); j++) {
            loadVideoForLayer(context, children[j])
          }
        }
      }
      done = true
    }
  }, 1000)
}

function loadVideoForLayer (context, layer) {
  log('Checking layer ' + layer + ' for video data')
  const fileName = context.command.valueForKey_onLayer(gifMeVideoNameKey, layer)
  let data = context.command.valueForKey_onLayer(gifMeVideoDataKey, layer)
  if (fileName && data) {
    log('Found video: ' + fileName)
    data = NSData.alloc().initWithBase64EncodedString_options(data, null)
    const videoPath = tempDir('video') + fileName
    data.writeToFile_atomically(videoPath, false)
    insertVideo(context, videoPath, layer, true)
  }
}
