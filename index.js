const { app, BrowserWindow, globalShortcut } = require('electron');

app.on('ready', () => {
    let mainWindow = new BrowserWindow({
        // fullscreen: true
        width: 1024,
        height: 768
    });

    mainWindow.loadURL(`file://${__dirname}/src/index.html`);
});