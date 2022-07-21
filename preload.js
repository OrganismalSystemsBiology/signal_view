const { contextBridge, ipcRenderer } = require('electron')
const dayjs = require('dayjs')

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency])
  }
})

contextBridge.exposeInMainWorld('api', {
  requestBasicInfo: async () => {
    return await ipcRenderer.invoke("requestBasicInfo")
  },
  unzipVoltPlot: async (zipUrl) => {
    return await ipcRenderer.invoke("unzipVoltPlot", zipUrl)
  },
  unzipSpecPlot: async (specPage) => {
    return await ipcRenderer.invoke("unzipSpecPlot", specPage)
  },
  requestEpochVideoList: async () => {
    return await ipcRenderer.invoke("requestEpochVideoList")
  },
  requestVideoOffset: async (videoIdx) => {
    return await ipcRenderer.invoke('requestVideoOffset', videoIdx)
  },
  setVideoOffset: async (videoIdx, offset) => {
    return await ipcRenderer.invoke("setVideoOffset", videoIdx, offset)
  },
  saveVideoInfo: async () => {
    return await ipcRenderer.invoke("saveVideoInfo")
  },
  loadStages: async (epochCells) => {
    return await ipcRenderer.invoke("loadStages", epochCells)
  },
  saveStages: async (epochCells, stageFile) => {
    return await ipcRenderer.invoke("saveStages", epochCells, stageFile)
  }
})


contextBridge.exposeInMainWorld('electron', {
  now: () => {
    const now = dayjs().toDate()
    return now;
  }
})