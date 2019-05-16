const fs = require('fs');
const util = require('../utils');
const log = require('../utils/logger');
const inquirer = require('inquirer');
const rimraf = require('rimraf');
const shelljs = require('shelljs');
const ora = require('ora');
const decompress = require('decompress');
const tmp = require('tmp');
const request = require('request');
const isWin = /^win/.test(process.platform);
const dirCut = isWin ? "\\" : "/";

function add(op) {
    let path = process.cwd();
    path += dirCut + 'plugins' + dirCut + 'ios' + dirCut;
    util.mkdirsSync(path);
    path += op.name;
    if (checkModuleExist(op)) {
        inquirer.prompt([{
            type: 'confirm',
            message: `iOS端已存在名为${op.name}的插件，是否覆盖安装？`,
            name: 'ok'
        }]).then(answers => {
            if (answers.ok) {
                rimraf(path, () => {
                    log.info('开始添加iOS端插件');
                    op.isCover = true;
                    download(op)
                })
            } else {
                log.fatalContinue(`iOS端放弃安装${op.name}！`);
            }
        }).catch(console.error);
    } else {
        log.info('开始添加iOS端插件');
        download(op)
    }
}

function checkModuleExist(op) {
    let path = process.cwd();
    path += dirCut + 'plugins' + dirCut + 'ios' + dirCut + op.name;
    return fs.existsSync(path)
}

function remove(op) {
    op.myCallback = () => {
        invokeScript(op, false, () => {
            removePorject(op)
        });
    };
    changeProfile(op, false);
}

function removePorject(op) {
    let path = process.cwd();
    path += dirCut + 'plugins' + dirCut + 'ios' + dirCut + op.name;
    rimraf(path, () => {
        log.weiuis('iOS端插件移除完毕！');
        request(op.baseUrl + op.name + '?act=uninstall&platform=ios');
    })
}

function download(op) {
    let outputPath = process.cwd();
    outputPath += dirCut + 'plugins' + dirCut + 'ios' + dirCut + op.name;
    //
    let downPath = tmp.tmpNameSync({dir: require('os').tmpdir()}) + ".zip";
    let file = fs.createWriteStream(downPath);
    file.on("close", () => {
        decompress(downPath, outputPath).then(() => {
            fs.unlinkSync(downPath);
            util.removeRubbish(outputPath);
            invokeScript(op, true, () => {
                changeProfile(op, true);
                request(op.baseUrl + op.name + '?act=install&platform=ios');
            });
        })
    }).on("error", (err) => {
        log.fatal(`插件${op.name} iOS端下载失败: ${err}！`);
    });
    //
    let startDownload = (downUrl) => {
        let spinFetch = ora('插件' + op.name + ' iOS端正在下载...');
        spinFetch.start();
        request.get(downUrl).on("error", function (err) {
            log.fatal(`插件${op.name} iOS端下载失败: ${err}！`);
        }).on("response", function (res) {
            if (res.statusCode !== 200) {
                log.fatal(`插件${op.name} iOS端下载失败: Get zipUrl return a non-200 response！`);
            }
        }).on("end", function () {
            spinFetch.stop();
            log.info('插件' + op.name + ' iOS端下载完毕，开始安装！');
        }).pipe(file);
    };
    //
    if (util.count(op.ios_lists) <= 1 || op.simple === true) {
        startDownload(op.ios_url);
        return;
    }
    let lists = [];
    op.ios_lists.forEach(t => {
        let name = t.name;
        if (name.substr(-4, 4) === '.zip') name = name.substr(0, name.length - 4);
        lists.push({
            name: (lists.length + 1) + ". " + name + (t.desc ? " (" + t.desc + ")" : ""),
            value: t.path
        });
    });
    let array = [{
        type: 'list',
        name: 'release',
        message: `选择插件${op.name} iOS端版本：`,
        choices: lists
    }];
    inquirer.prompt(array).then(function(answers) {
        startDownload(answers.release);
    });

}

function changeProfile(op, add) {
    let path = process.cwd();
    path += dirCut + 'platforms' + dirCut + 'ios' + dirCut + 'WeexWeiui' + dirCut;
    process.chdir(path);
    path += 'Podfile';
    let result = fs.readFileSync(path, 'utf8');
    let temp = result.split('\n');
    let out = [];
    let weg = [];
    let hasEnd = false;
    temp.forEach((item) => {
        if (item.trim() === 'end') {
            hasEnd = true
        }
        if (!hasEnd) {
            if (item.indexOf('\'' + op.name + '\'') === -1) {
                out.push(item)
            }
        } else {
            weg.push(item)
        }
    });
    if (add) {
        out.push('    pod \'' + op.name + '\', :path => \'../../../plugins/ios/' + op.name + '\'');
    }
    weg.forEach((item) => {
        out.push(item)
    });
    let px = '';
    out.forEach((item) => {
        px += item + '\n'
    });
    fs.writeFileSync(path, px.replace(/^\n+|\n+$/g, ""), {encode: 'utf-8'});
    if (op.simple === true) {
        if (add) {
            log.weiuis('插件' + op.name + ' iOS端添加完成!');
        } else {
            log.info('插件' + op.name + ' iOS端清理完成!')
        }
        process.chdir('../../../');
        if (typeof op.myCallback === 'function') {
            op.myCallback();
        }
    }else if (shelljs.which('pod')) {
        let spinPod = ora('开始执行pod install...');
        spinPod.start();
        shelljs.exec('pod install', {silent: true}, function(){
            spinPod.stop();
            if (add) {
                log.weiuis('插件' + op.name + ' iOS端添加完成!');
            } else {
                log.info('插件' + op.name + ' iOS端清理完成!')
            }
            process.chdir('../../../');
            if (typeof op.myCallback === 'function') {
                op.myCallback();
            }
        });
    }else{
        if (add) {
            log.weiuis('插件' + op.name + ' iOS端添加完成!');
        } else {
            log.info('插件' + op.name + ' iOS端清理完成!')
        }
        if (!isWin) {
            log.info('未检测到系统安装pod，请安装pod后手动执行pod install！');
        }
        process.chdir('../../../');
        if (typeof op.myCallback === 'function') {
            op.myCallback();
        }
    }
}

function invokeScript(op, isInstall, callback) {
    let path = process.cwd();
    path += dirCut + 'plugins' + dirCut + 'ios' + dirCut + op.name;
    let jsPath = '';
    if (isInstall) {
        jsPath = path + dirCut + '.weiuiScript' + dirCut + 'install.js';
    }else{
        jsPath = path + dirCut + '.weiuiScript' + dirCut + 'uninstall.js'
    }
    if (!fs.existsSync(jsPath)) {
        if (typeof callback === 'function') {
            callback(false);
        }
    }else{
        util.exec('node ' + jsPath).then(() => {
            if (typeof callback === 'function') {
                callback(true);
            }
        });
    }
}

module.exports = {add, remove, invokeScript, changeProfile};
