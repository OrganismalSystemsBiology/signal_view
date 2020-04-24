const { app, Menu, BrowserWindow } = require('electron')

let win

// Menu bar を非表示
Menu.setApplicationMenu(null);

function createWindow() {

    //ウインドウの作成
    win = new BrowserWindow({ webPreferences: { nodeIntegration: true }, width: 800, height: 400 })

    //ウインドウに表示する内容
    win.loadFile('app_test_20200409.html')

    //デバッグ画面表示
    win.webContents.openDevTools()

    //このウインドウが閉じられたときの処理
    win.on('closed', () => {
        win = null
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