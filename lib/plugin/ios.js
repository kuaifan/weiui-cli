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

function add(op) {
    let path = process.cwd();
    path += '/plugins/ios/';
    util.mkdirsSync(path);
    path += op.name;
    if (checkModuleExist(op)) {
        inquirer.prompt([{
            type: 'confirm',
            message: `ios端已存在名为${op.name}的插件，是否覆盖安装？`,
            name: 'ok'
        }]).then(answers => {
            if (answers.ok) {
                rimraf(path, () => {
                    log.info('开始添加ios端插件');
                    op.isCover = true;
                    download(op)
                })
            } else {
                log.fatalContinue(`ios端放弃安装${op.name}！`);
            }
        }).catch(console.error);
    } else {
        log.info('开始添加ios端插件');
        download(op)
    }
}

function checkModuleExist(op) {
    let path = process.cwd();
    path += '/plugins/ios/' + op.name;
    return fs.existsSync(path)
}

function remove(op) {
    op.myCallback = function() {
        invokeScript(op, true);
        removePorject(op)
    };
    changeProfile(op, false);
}

function removePorject(op) {
    let path = process.cwd();
    path += '/plugins/ios/' + op.name;
    rimraf(path, () => {
        log.weiuis('ios端插件移除完毕！');
    })
}

function download(op) {
    let outputPath = process.cwd();
    outputPath += '/plugins/ios/' + op.name;
    //
    let downPath = tmp.tmpNameSync({dir: require('os').tmpdir()}) + ".zip";
    let file = fs.createWriteStream(downPath);
    file.on("close", () => {
        decompress(downPath, outputPath).then(() => {
            fs.unlinkSync(downPath);
            invokeScript(op, false);
            changeProfile(op, true);
        })
    }).on("error", (err) => {
        log.fatal(`插件${op.name} ios端下载失败: ${err}！`);
    });
    //
    let spinFetch = ora('插件' + op.name + ' ios端正在下载...');
    spinFetch.start();
    request.get(op.ios_url).on("error", function (err) {
        log.fatal(`插件${op.name} ios端下载失败: ${err}！`);
    }).on("response", function (res) {
        if (res.statusCode !== 200) {
            log.fatal(`插件${op.name} ios端下载失败: Get zipUrl return a non-200 response！`);
        }
    }).on("end", function () {
        spinFetch.stop();
        log.info('插件' + op.name + ' ios端下载完毕，开始安装！');
    }).pipe(file);
}

function changeProfile(op, add) {
    let path = process.cwd();
    path += '/platforms/ios/WeexWeiui/';
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
    if (shelljs.which('pod')) {
        let spinPod = ora('开始执行pod install...');
        spinPod.start();
        shelljs.exec('pod install', {silent: true}, function(){
            spinPod.stop();
            if (add) {
                log.weiuis('插件' + op.name + ' ios端添加完成!');
            } else {
                log.info('插件' + op.name + ' ios端清理完成!')
            }
            process.chdir('../../../');
            if (typeof op.myCallback === 'function') {
                op.myCallback();
            }
        });
    }else{
        if (add) {
            log.weiuis('插件' + op.name + ' ios端添加完成!');
        } else {
            log.info('插件' + op.name + ' ios端清理完成!')
        }
        log.info('未检测到系统安装pod，请安装pod后手动执行pod install!');
        process.chdir('../../../');
        if (typeof op.myCallback === 'function') {
            op.myCallback();
        }
    }
}

function invokeScript(op, isRemove) {
    let path = process.cwd();
    path += '/plugins/ios/' + op.name;
    let jsPath = path + '/.weiuiScript/install.js';
    if (isRemove) {
        jsPath = path + '/.weiuiScript/uninstall.js'
    }
    if (fs.existsSync(jsPath)) {
        util.exec('node ' + jsPath).then(() => {
            //
        });
    }
}

module.exports = {add, remove, invokeScript};