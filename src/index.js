const md5 = require('md5');
const { desktopCapturer } = require('electron');
const SCALE = 0.6;

let state = {
    isSetting: localStorage.isSettinged,
    setting: {
        areaMode: 'q'
    },
    main: {

    },
    captureOptions: {
        types: ['window'],
        thumbnailSize: {
            width: Number.parseInt(screen.width * SCALE),
            height: Number.parseInt(screen.height * SCALE)
        }
    },
    config: {
        ocr_api: 'https://api.ai.qq.com/fcgi-bin/ocr/ocr_generalocr',
    }
};

let doms = {
    iframe: document.querySelector('#iframe'),
    btnRun: document.querySelector('#run-btn'),
    apiIdInput: document.querySelector('#app_id'),
    apiKeyInput: document.querySelector('#app_key'),
    btnSetting: document.querySelector('#setting-btn'),
    windowNameInput: document.querySelector('#window_name'),
    previewCanvas: document.querySelector('#preview_canvas'),
};

toggleWindow();

initConfig();

initSetting();

initMain();

function toggleWindow() {
    let { isSetting } = state;
    let { btnSetting, btnRun } = doms;
    state.isSetting = isSetting = !isSetting;
    btnRun.disabled = isSetting;
    btnSetting.value = !isSetting ? '设置' : '保存';
    document.querySelector('#setting-window').style.display = isSetting ? 'block' : 'none';
    iframe.style.display = isSetting ? 'none' : 'block';
}

function initConfig() {
    if (!state.isSetting) {
        Object.assign(state.config, JSON.parse(localStorage.config || ''));
    }
}

function initSetting() {
    let { isSetting, config, setting, captureOptions } = state;
    let { windowNameInput, apiIdInput, apiKeyInput, previewCanvas, btnSetting } = doms;
    let { areaMode } = setting;

    // 设置按钮
    btnSetting.addEventListener('click', function() {
        toggleWindow();

        if(!state.isSetting) {
            localStorage.setItem('config', JSON.stringify(config));
            localStorage.setItem('isSettinged', true);
        }
    });

    apiIdInput.value = config.app_id || '';
    apiIdInput.addEventListener('change', function(e) {
        config.app_id = +e.target.value.trim();
    });

    apiKeyInput.value = config.app_key || '';
    apiKeyInput.addEventListener('change', function(e) {
        config.app_key = e.target.value.trim();
    });

    // 窗口名称
    windowNameInput.value = config.window_name || '';
    windowNameInput.addEventListener('change', function(e) {
        config.window_name = e.target.value.trim();
    });


    // 抓取按钮
    document.querySelector('#btn_test').addEventListener('click', function(){
        desktopCapturer.getSources(captureOptions, function(error, source) {
            if (error) {
                alert(`出错了：${error}`);
                return;
            }

            document.querySelector('#window_names').innerText = source.map(item => item.name).join(' | ');

            let targetWindow = source.find(item => item.name === config.window_name);
            if (targetWindow) {
                state.setting.img = targetWindow.thumbnail;
                state.setting.imgEle = null;
                drawPreview(true);
            } else {
                alert('没有找到目标窗口，请确保窗口名称填写正确！');
            }
        });
    });

    // 题目及选项区域
    let start = {};
    let end = {};
    document.querySelector('#q-btn').addEventListener('click', function(){ areaMode = 'q' });
    document.querySelector('#a-btn').addEventListener('click', function(){ areaMode = 'a' });

    previewCanvas.addEventListener('pointerdown', e => {
        start = {
            x: e.layerX,
            y: e.layerY
        }
    });

    previewCanvas.addEventListener('pointermove', e => {
        if(Object.keys(start).length === 0) return;
        end = {
            x: e.layerX,
            y: e.layerY
        }
        let area = areaMode === 'q' ? {qArea: {start, end}} : {aArea: {start, end}};
        Object.assign(state.config, area);
        drawPreview();
    });

    previewCanvas.addEventListener('pointerup', e => {
        start = {};
        end = {};
    });
}

function initMain() {
    let { btnRun } = doms;

    btnRun.addEventListener('click', e => {
        let { config, captureOptions } = state;
        let { window_name, app_id, app_key, qArea, aArea } = config;

        desktopCapturer.getSources(captureOptions, (error, source) => {
            if(error){
                alert(`出错了： ${error}`)
                return;
            }

            let targetWindow = source.find(item => item.name === window_name);
            if(targetWindow) {
                let params = {
                    app_id,
                    nonce_str: '20e3408a79',
                    time_stamp: Math.floor(new Date().getTime()/1000),
                    image: targetWindow.thumbnail.toDataURL().replace('data:image/png;base64,', '')
                };
                params.sign = getReqSign(params, app_key);

                fetch(config.ocr_api, {
                    method: 'POST',
                    body: formUrlencoded(params),
                    headers: {
                        'Content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
                    }
                })
                    .then(resp => resp.json())
                    .then(resp => {
                        let { item_list } = resp.data;
                        let question = item_list
                                        .filter(item => item.itemcoord[0].y > qArea.start.y && item.itemcoord[0].y < qArea.end.y)
                                        .map(item => item.itemstring)
                                        .join('');
                        let answer = item_list
                                        .filter(item => item.itemcoord[0].y > aArea.start.y && item.itemcoord[0].y < aArea.end.y)
                                        .map(item => item.itemstring)
                                        .join(' ');
                        iframe.src = `http://www.baidu.com/s?wd=${question+answer}`;
                    });
            } else {
                alert('没有找到目标窗口，请确保窗口名称填写正确！')
            }
        });
    });
}

function drawPreview() {
    let { img, imgEle } = state.setting;
    let { qArea, aArea } = state.config;
    let { previewCanvas } = doms;

    let imgSize = img.getSize();
    let ctx = previewCanvas.getContext('2d');
    previewCanvas.width = imgSize.width;
    previewCanvas.height = imgSize.height;


    if (!imgEle) {
        ctx.clearRect(0, 0, imgSize.width, imgSize.height);
        let imgEle = new Image();
        imgEle.onload = function() {
            Object.assign(state.setting, {imgEle});
            ctx.drawImage(imgEle, 0, 0);
        };
        imgEle.src = img.toDataURL();
    } else {
        ctx.drawImage(imgEle, 0, 0);
    }

    let x, y, w, h;
    if(qArea) {
        ctx.strokeStyle = '#f00';
        x = qArea.start.x;
        y = qArea.start.y;
        w = qArea.end.x - qArea.start.x;
        h = qArea.end.y - qArea.start.y;
        ctx.strokeRect(x, y, w, h);
    }

    if(aArea) {
        ctx.strokeStyle = '#0f0';
        x = aArea.start.x;
        y = aArea.start.y;
        w = aArea.end.x - aArea.start.x;
        h = aArea.end.y - aArea.start.y;
        ctx.strokeRect(x, y, w, h);
    }
}

function getReqSign(params = {}, app_key) {
    let str = formUrlencoded(params) + `&app_key=${app_key}`;
    return md5(str).toUpperCase();
}

function formUrlencoded(params = {}){
    return Object
            .keys(params)
            .map((key) => `${key}=${encodeURIComponent(params[key])}`)
            .sort()
            .join('&');
}