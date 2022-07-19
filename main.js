const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs');
const fflate = require('fflate')
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync')
const dayjs = require('dayjs')

app.commandLine.appendSwitch('js-flags', '--max-old-space-size=16384');

let win;
let fasterDir
let deviceId
let plotDir
let basicInfo
let mesLenSec
let epochLenSec
let epochPerPage
let videoInfoPath
let videoInfo
let epochVideoList

function setBasicInfo() {
    basicInfo = JSON.parse(fs.readFileSync(path.join(plotDir.voltPlot_dir, 'signal_view.json'), 'utf8'));
    mesLenSec = basicInfo['mes_len_sec']
    epochLenSec = basicInfo['epoch_len_sec']
    epochPerPage = basicInfo['epoch_per_page']
}

function getPlotDir() {
    return new Promise((resolve, reject) => {
        if ( process.argv.length < 4) {
            // faster_dir と device_id がコマンドラインで与えられていない場合、ダイアログ起動
            result = dialog.showOpenDialogSync(win,{defaultPath: ".", properties: ['openDirectory'],
                                                    title: "select the voltage plot directory of a recording device"});
            if(!result) {
                reject('Canceled at selecting the voltage plot directory')
            } else {
                const voltageDirPath = path.normalize(result[0])
                deviceId = path.basename(voltageDirPath)
                fasterDir = path.dirname(path.dirname(path.dirname(path.dirname(voltageDirPath))))
            }
        } else {
            fasterDir = process.argv[2]
            deviceId = process.argv[3]
        }
        fasterDir = path.resolve(path.normalize(fasterDir))
        voltPlotDir =  path.join(fasterDir, 'result', 'figure', 'voltage', deviceId)
        specPlotDir = path.join(fasterDir, 'result', 'figure', 'spectrum', deviceId)
        resolve({
            'faster_dir': fasterDir,
            'device_id': deviceId,
            'voltPlot_dir': voltPlotDir,
            'specPlot_dir': specPlotDir})
    })
}

function createWindow() {
    win = new BrowserWindow({
        width: 1600,
        height: 500,
        backgroundColor: '#fff',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    // Obtain the path of the target voltage plot directory
    getPlotDir().then((res) => {
            plotDir = res
        }).catch((err) => {
            console.log(err)
            win.close()
            return
        })

    win.setPosition(0, 0)

    win.loadFile('signal_view.html')
    win.webContents.openDevTools()
}

function readCsvSync(filename, options) {
    const content = fs.readFileSync(filename).toString();
    return parse(content, options);
}

// Initialize the window
app.whenReady().then(() => {
    createWindow()

    // macOS needs the listner to "activate" the window from the dock
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
      })
})

app.on('window-all-closed', () => {
    // macOS continues to run the app after all windows are closed
    if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('requestBasicInfo', () => {
    setBasicInfo()
    const pageNum = mesLenSec / epochLenSec / epochPerPage
    const epoch_num_aday = 3600*24 / epochLenSec

    // prepare a list of files
    const page_idx =  Array.from(Array(pageNum).keys())
    const plotPages = page_idx.map(i => {
        let idx = (i * epochPerPage + 1).toString().padStart(6, '0')
        let dayIdx = (Math.floor(i * epochPerPage / epoch_num_aday) + 1).toString().padStart(2, '0')
        let filename = path.normalize(path.join(plotDir.voltPlot_dir, deviceId + "_day" + dayIdx + ".zip", deviceId + "." + idx + ".jpg"))
        filename = filename.replace(/\\/g, '/')
        return {'filename':filename, 'startStageIdx':i * epochPerPage}
    });

    basicInfo.plot_pages = plotPages
    basicInfo.device_id = deviceId

    return basicInfo
})

ipcMain.handle('unzip', (event, zipUrl) => {
    console.log('Unzipping', zipUrl)
    const buf = new Uint8Array(fs.readFileSync(zipUrl).buffer)
    return fflate.unzipSync(buf);
})


ipcMain.handle('unzipSpecPlot', (event, specPage) => {
    pageStr = specPage.toString().padStart(6, '0')
    specPlotZippath = path.normalize(path.join(plotDir.specPlot_dir, pageStr + '.zip'))
    console.log('Unzipping', specPlotZippath)
    const buf = new Uint8Array(fs.readFileSync(specPlotZippath).buffer)
    return fflate.unzipSync(buf);
})


ipcMain.handle('requestEpochVideoList', () =>{
    // set the analysis start datetime from exp.info.csv
    const expInfoPath = path.join(fasterDir, "data", "exp.info.csv")
    const res = readCsvSync(expInfoPath, {columns:false, from_line: 2});
    const startDT = dayjs(res[0][2])
    const endDT = dayjs(res[0][3])
    const startDTStr = startDT.format("YYYY/MM/DD HH:mm:ss")

    // process video.info.csv
    const videoDir = path.join(fasterDir, "video", deviceId)
    videoInfoPath = path.join(videoDir, "video.info.csv")
    const videoInfoCsv = readCsvSync(videoInfoPath, {columns:false, from_line: 2});
    videoInfo = []
    for (let i=0; i<videoInfoCsv.length; i++){
        const r = videoInfoCsv[i]
        const videoStartDT = dayjs(r[1])
        const videoEndDT   = dayjs(r[2])
        videoInfo.push({filename: path.join(videoDir, r[0]), 
                        start_dt: videoStartDT,
                        end_dt: videoEndDT,
                        start_a: videoStartDT.diff(startDT), // analysis time of start: milliseconds relative to the analysis start
                        end_a: videoEndDT.diff(startDT), // analysis time of end: milliseconds relative to the analysis start
                        offset: parseFloat(r[3])})
    }
    
    // construct a mapping list from epoch index to video&position
    const epochNum = Math.floor(endDT.diff(startDT, 'seconds') / epochLenSec)
    epochVideoList = Array(epochNum)
    let videoInfoCounter = 0
    for (let i=0; i<epochNum; i++){
        let epochTime = i * epochLenSec * 1000 // milliseconds
        let vi = videoInfo[videoInfoCounter]
        // skip the epoch if it is before the video
        if (epochTime < vi['start_a']){
            epochVideoList[i] = {'video_src': 'noVideo', 'video_idx':-1, 'position': 0}
            continue
        }

        if (epochTime < vi['end_a']) {
            epochVideoList[i] = {'video_src': vi['filename'], 
                                 'video_idx': videoInfoCounter,
                                 'position': (epochTime - vi['start_a'])/1000 // seconds
                                }
        } else {
            // seek the videoInfoCounter to cover the epochTime
            while ( (epochTime >= vi['end_a']) && ((videoInfo.length - 1) > videoInfoCounter) ){
                videoInfoCounter += 1
                vi = videoInfo[videoInfoCounter]
            }
            if (videoInfoCounter < (videoInfo.length - 1)){
                epochVideoList[i] = {'video_src': vi['filename'],
                                     'video_idx': videoInfoCounter,
                                     'position': (epochTime - vi['start_a'])/1000 // seconds
                                    }    
            } else {
                epochVideoList[i] = {'video_src': 'noVideo', 'video_idx': -1, 'position': 0}
            }        
        }
    }
    return epochVideoList
})

ipcMain.handle("requestVideoOffset", (event, videoIdx) => {
    return videoInfo[videoIdx]['offset']
})


ipcMain.handle("setVideoOffset", (event, videoIdx, offset) =>{
    videoInfo[videoIdx]['offset'] = offset
    console.log(videoInfo[videoIdx])
})


ipcMain.handle("saveVideoInfo", ()=>{
    videoInfoTable = []
    for(i=0; i<videoInfo.length; i++){
        videoInfoTable.push({
            filename: path.basename(videoInfo[i]['filename']),
            start_dt: videoInfo[i]['start_dt'].format("YYYY-MM-DD HH:mm:ss.SSSSSS"),
            end_dt: videoInfo[i]['end_dt'].format("YYYY-MM-DD HH:mm:ss.SSSSSS"),
            offset: videoInfo[i]['offset']
        })
    }
    csvString = stringify(videoInfoTable, {
        header: ['filename', 'start_datetime', 'end_datetime', 'offset'],
        quoted_string: false
    });
    fs.writeFileSync(videoInfoPath, csvString)
})