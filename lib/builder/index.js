const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const fsEx = require('fs-extra');
const uuid = require('uuid');
const ip = require('ip').address();
const net = require('net');
const chalk = require('chalk');
const Gauge = require('gauge');
const notifier = require('node-notifier');
const WeiuiBuilder = require('./weiuiBuilder');
const utils = require('../utils');

let socketAlready = false;
let socketTimeout = null;
let socketClients = [];
let fileMd5Lists = {};

module.exports = {
    host: ip,
    port: 8880,
    source: "src/pages",
    dist: "common/dist",

    portIsOccupied(port, callback) {
        const server = net.createServer().listen(port);
        server.on('listening', () => {
            server.close();
            callback(null, port);
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                this.portIsOccupied(port + 1, callback);
            } else {
                callback(err)
            }
        });
    },

    createServer(contentBase, port) {
        http.createServer((req, res) => {
            let url = req.url;
            let file = contentBase + url;
            fs.readFile(file, (err, data) => {
                if (err) {
                    fs.readFile(__dirname + '/404.js', (err, data) => {
                        if (err) {
                            res.writeHeader(404, {
                                'content-type': 'text/html;charset="utf-8"'
                            });
                            res.write('<h1>404错误</h1><p>你要找的页面不存在</p>');
                            res.end();
                        } else {
                            res.writeHeader(200, {
                                'content-type': 'text/plain; charset=utf-8'
                            });
                            res.write(data);
                            res.end();
                        }
                    });
                    return;
                }
                res.writeHeader(200, {
                    'content-type': 'text/plain; charset=utf-8'
                });
                res.write(data);
                res.end();
            });
        }).listen(port);
    },

    copySrcToDist() {
        let _copyEvent = (originDir, newDir) => {
            let lists = fs.readdirSync(originDir);
            lists.forEach((item) => {
                let originPath = originDir + "/" + item;
                let newPath = newDir + "/" + item;
                fs.stat(originPath, (err, stats) => {
                    if (typeof stats === 'object') {
                        if (stats.isFile()) {
                            if (/(\.(png|jpe?g|gif|ttf|svg|js)$)/.test(originPath)) {
                                if (!fs.existsSync(newPath)) {
                                    fsEx.copy(originPath, newPath);
                                }
                            }
                        } else if (stats.isDirectory()) {
                            _copyEvent(originPath, newPath)
                        }
                    }
                });
            });
        };
        _copyEvent(path.resolve(this.source), path.resolve(this.dist));
    },

    copyFileMd5(originPath, newPath, callback) {
        let stream = fs.createReadStream(originPath);
        let md5sum = crypto.createHash('md5');
        stream.on('data', (chunk) => {
            md5sum.update(chunk);
        });
        stream.on('end', () => {
            let str = md5sum.digest("hex").toUpperCase();
            if (fileMd5Lists[newPath] !== str) {
                fileMd5Lists[newPath] = str;
                fsEx.copy(originPath, newPath, callback);
            }
        });
    },

    syncFolderEvent(host, port, socketPort, removeBundlejs) {
        let jsonData = require(path.resolve('weiui.config'));
        jsonData.socketHost = host ? host : '';
        jsonData.socketPort = socketPort ? socketPort : '';
        jsonData.wxpay.appid = utils.getObject(jsonData, 'wxpay.appid');
        //
        let isSocket = !!(host && socketPort);
        let hostUrl = 'http://' + host + ':' + port + '/' + this.dist;
        //
        let random = Math.random();
        let deviceIds = {};
        //
        let copyJsEvent = (originDir, newDir) => {
            let lists = fs.readdirSync(originDir);
            lists.forEach((item) => {
                let originPath = originDir + "/" + item;
                let newPath = newDir + "/" + item;
                if (!/(\.web\.js|\.web\.map|\.DS_Store|__MACOSX)$/.exec(originPath)) {
                    fs.stat(originPath, (err, stats) => {
                        if (typeof stats === 'object') {
                            if (stats.isFile()) {
                                this.copyFileMd5(originPath, newPath, (err) => {
                                    //!err && console.log(newPath);
                                    if (!err && socketAlready) {
                                        socketClients.map((client) => {
                                            let deviceKey = client.deviceId + hostUrl + '/' + item;
                                            if (client.ws.readyState !== 2 && deviceIds[deviceKey] !== random) {
                                                deviceIds[deviceKey] = random;
                                                client.ws.send('RELOADPAGE:' + hostUrl + '/' + item);
                                            }
                                        });
                                    }
                                });
                            } else if (stats.isDirectory()) {
                                copyJsEvent(originPath, newPath)
                            }
                        }
                    });
                }
            });
        };
        //syncFile Android
        fs.stat(path.resolve('platforms/android'), (err, stats) => {
            if (typeof stats === 'object' && stats.isDirectory()) {
                let androidLists = fs.readdirSync(path.resolve('platforms/android'));
                androidLists.forEach((item) => {
                    let mainPath = 'platforms/android/' + item + '/app/src/main';
                    let assetsPath = mainPath + '/assets/weiui';
                    fs.stat(path.resolve(mainPath), (err, stats) => {
                        if (typeof stats === 'object' && stats.isDirectory()) {
                            if (removeBundlejs) {
                                fsEx.remove(path.resolve(assetsPath), (err) => {
                                    if (err) throw err;
                                    fsEx.outputFile(path.resolve(assetsPath + '/config.json'), JSON.stringify(jsonData));
                                    copyJsEvent(path.resolve(this.dist), path.resolve(assetsPath));
                                });
                            }else{
                                copyJsEvent(path.resolve(this.dist), path.resolve(assetsPath));
                            }
                        }
                    });
                });
            }
        });
        //syncFile iOS
        fs.stat(path.resolve('platforms/ios'), (err, stats) => {
            if (typeof stats === 'object' && stats.isDirectory()) {
                let iosLists = fs.readdirSync(path.resolve('platforms/ios'));
                iosLists.forEach((item) => {
                    let mainPath = 'platforms/ios/' + item;
                    let bundlejsPath = mainPath + '/bundlejs/weiui';
                    fs.stat(path.resolve(mainPath), (err, stats) => {
                        if (typeof stats === 'object' && stats.isDirectory()) {
                            if (removeBundlejs) {
                                fsEx.remove(path.resolve(bundlejsPath), (err) => {
                                    if (err) throw err;
                                    fsEx.outputFile(path.resolve(bundlejsPath + '/config.json'), JSON.stringify(jsonData));
                                    copyJsEvent(path.resolve(this.dist), path.resolve(bundlejsPath));
                                });
                            }else{
                                copyJsEvent(path.resolve(this.dist), path.resolve(bundlejsPath));
                            }
                        }
                    });
                    let plistPath = 'platforms/ios/' + item + '/WeiuiApp/Info.plist';
                    utils.replaceDictString(path.resolve(plistPath), 'weiuiAppWxappid', jsonData.wxpay.appid);
                });
            }
        });
        //WebSocket
        if (isSocket) {
            if (socketAlready === false) {
                socketAlready = true;
                let WebSocketServer = require('ws').Server,
                    wss = new WebSocketServer({port: socketPort});
                wss.on('connection', (ws, info) => {
                    let deviceId = uuid.v4();
                    socketClients.push({deviceId, ws});
                    ws.on('close', () => {
                        for (let i = 0, len = socketClients.length; i < len; i++) {
                            if (socketClients[i].deviceId === deviceId) {
                                socketClients.splice(i, 1);
                                break;
                            }
                        }
                    });
                    //
                    let mode = utils.getQueryString(info.url, "mode");
                    switch (mode) {
                        case "initialize":
                            ws.send('HOMEPAGE:' + hostUrl + '/index.js');
                            break;

                        case "back":
                            ws.send('HOMEPAGEBACK:' + hostUrl + '/index.js');
                            break;

                        case "reconnect":
                            //ws.send('REFRESH');
                            break;
                    }
                });
            }
            notifier.notify({
                title: 'WiFi真机同步',
                message: jsonData.socketHost + ':' + jsonData.socketPort,
                contentImage: path.join(__dirname, 'logo.png')
            });
            socketTimeout && clearInterval(socketTimeout);
            socketTimeout = setTimeout(() => {
                let msg = '';
                msg+= chalk.bgBlue.bold.black(`【WiFI真机同步】`);
                msg+= chalk.bgBlue.black(`IP地址: `);
                msg+= chalk.bgBlue.bold.black.underline(`${jsonData.socketHost}`);
                msg+= chalk.bgBlue.black(`、端口号: `);
                msg+= chalk.bgBlue.bold.black.underline(`${jsonData.socketPort}`);
                console.log(); console.log(msg);
            }, 100);
        } else {
            notifier.notify({
                title: 'Weiui',
                message: "Build successful",
                contentImage: path.join(__dirname, 'logo.png')
            });
        }
    },

    dev() {
        let gauge = new Gauge();
        let maxProgress = 0;
        let options = {
            watch: true,
            ext: 'vue',
            web: false,
            min: false,
            devtool: undefined,
            config: undefined,
            base: undefined,
            onProgress: (complete, action) => {
                if (complete > maxProgress) {
                    maxProgress = complete;
                } else {
                    complete = maxProgress;
                }
                gauge.show(action, complete);
            }
        };
        fsEx.removeSync(path.resolve(this.dist));
        //
        let serverStatus = 0;
        let serverPort = this.port;
        let socketPort = this.port + 1;
        let callback = (error, output) => {
            gauge.hide();
            console.log();
            if (error) {
                console.log(chalk.red('Build Failed!'));
                utils.each(error, (index, item) => { console.error(item); });
            } else {
                console.log('Build completed!');
                console.log(output.toString());
                //
                if (serverStatus === 0) {
                    serverStatus = 1;
                    this.portIsOccupied(serverPort, (err, port) => {
                        if (err) throw err;
                        this.portIsOccupied(socketPort, (err, sPort) => {
                            if (err) throw err;
                            serverStatus = 200;
                            serverPort = port;
                            socketPort = sPort;
                            this.createServer(path.resolve(), serverPort);
                            this.copySrcToDist();
                            this.syncFolderEvent(this.host, serverPort, socketPort, true);
                        });
                    });
                }
            }
            if (serverStatus === 200) {
                this.copySrcToDist();
                this.syncFolderEvent(this.host, serverPort, socketPort, false);
            }
        };
        return new WeiuiBuilder(this.source, this.dist, options).build(callback);
    },

    build() {
        let gauge = new Gauge();
        let maxProgress = 0;
        let options = {
            watch: false,
            ext: 'vue',
            web: false,
            min: true,
            devtool: undefined,
            config: undefined,
            base: undefined,
            onProgress: (complete, action) => {
                if (complete > maxProgress) {
                    maxProgress = complete;
                } else {
                    complete = maxProgress;
                }
                gauge.show(action, complete);
            }
        };
        fsEx.removeSync(path.resolve(this.dist));
        //
        let callback = (error, output) => {
            gauge.hide();
            console.log();
            if (error) {
                console.log(chalk.red('Build Failed!'));
                utils.each(error, (index, item) => { console.error(item); });
            } else {
                console.log('Build completed!');
                console.log(output.toString());
                this.copySrcToDist();
                this.syncFolderEvent(null, null, null, true);
            }
        };
        return new WeiuiBuilder(this.source, this.dist, options).build(callback);
    }
};
