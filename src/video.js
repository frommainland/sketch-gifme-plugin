import { setInterval } from 'sketch-polyfill-setinterval'

export default function (context) {
  const outputDir = loadVideo(context)
  log(outputDir)
  if (!outputDir) {
    return
  }

  const count = NSFileManager
    .defaultManager()
    .contentsOfDirectoryAtPath_error(outputDir, null)
    .count()

  const images = []
  for (let i = 0; i < count; i++) {
    const imagePath = outputDir + '/' + i + '.jpg'
    images.push(NSImage.alloc().initByReferencingFile(imagePath))
  }

  const layer = context.document.selectedLayers().layers()[0]
  let index = 0

  setInterval(function () {
    const fill = layer.style().fills().firstObject()
    fill.setFillType(4)
    index = (index + 1) % images.length
    fill.setImage(MSImageData.alloc().initWithImage(images[index]))
    fill.setPatternFillType(1)
  }, 40)
}

function loadVideo (context) {
  const openPanel = NSOpenPanel.openPanel()
  openPanel.setCanChooseFiles(true)
  openPanel.setCanChooseDirectories(false)
  openPanel.setAllowsMultipleSelection(false)
  const clicked = openPanel.runModal()

  if (clicked == NSFileHandlingPanelOKButton) {
    const urls = openPanel.URLs()
    if (urls.count() > 0) {
      const path = urls[0].path()
      context.api().message(path)
      return exportFrames(path)
    }
  }
}

function exportFrames (filePath) {
  const outDir = tempDir('export' + randomInt(9999999))

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
  var tmp = NSTemporaryDirectory() + 'sketch-video-plugin/'
  if (name) {
    tmp += name + '/'
  }
  return tmp
}

function randomInt (max) {
  return Math.floor(Math.random() * max)
}