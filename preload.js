const { contextBridge, ipcRenderer } = require('electron')


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