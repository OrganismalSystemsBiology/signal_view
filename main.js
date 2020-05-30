const { app, Menu, BrowserWindow, dialog } = require('electron')
var path = require('path')

let win

// コマンドライン引数
global.sharedObject = {args: process.argv}

// Menu bar を非表示
Menu.setApplicationMenu(null);

function createWindow() {

    var faster_dir
    var device_id

    //ウインドウの作成
    win = new BrowserWindow({ webPreferences: { nodeIntegration: true }, width: 1600, height: 500})
 
    if (global.sharedObject.args.length < 4) {
        // faster_dir と device_id がコマンドラインで与えられていない場合、ダイアログ起動
        result = dialog.showOpenDialogSync(win,{defaultPath: ".", properties: ['openDirectory'],
                                                title: "select the voltage directory of a recording device"});
        if(!result){
            win.close()
            return
        }else{
            voltageDirPath = path.normalize(result[0])
            device_id = path.basename(voltageDirPath)
            faster_dir = path.dirname(path.dirname(path.dirname(path.dirname(voltageDirPath))))
            global.sharedObject.args = ["", "", faster_dir, device_id]
        }
    } else {
        faster_dir = path.normalize(global.sharedObject.args[2])
        device_id = global.sharedObject.args[3]
    }

    win.setPosition(0, 0)

    //ウインドウに表示する内容
    win.loadFile('signal_view.html')

    //デバッグ画面表示
    win.webContents.openDevTools()

    //このウインドウが閉じられたときの処理
    win.on('closed', () => {
        win = null
    })

    // set window title
    win.webContents.on('did-finish-load', () =>{
        win.setTitle('signal-view [' + faster_dir + '] (' + device_id + ')' )
    })
}

//アプリが初期化されたとき（起動されたとき）
app.on('ready', () => {
    createWindow()
})

//全ウインドウが閉じられたとき
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

//アクティブになったとき（MacだとDockがクリックされたとき）
app.on('activate', () => {
    if (win === null) {
        createWindow()
    }
})