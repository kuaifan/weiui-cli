const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const archiver = require("archiver");
const unzip2 = require("unzip2");
const lodash = require("lodash");
const utils = require('../utils');
const log = require('../utils/logger');

const backupMethod = {
    backup(callback) {
        let startBack = () => {
            let backupPath = path.resolve("common/backup");
            utils.mkdirsSync(backupPath);
            let zipPath = backupPath + "/" + utils.formatDate("YmdHis") + ".zip";
            let output = fs.createWriteStream(zipPath);
            let count = utils.count(process.cwd());
            let archive = archiver('zip', null);
            //备份文件
            let dirLists = [
                "/src",

                "/platforms/android/WeexWeiui/app/src/main/res/mipmap-hdpi",
                "/platforms/android/WeexWeiui/app/src/main/res/mipmap-ldpi",
                "/platforms/android/WeexWeiui/app/src/main/res/mipmap-mdpi",
                "/platforms/android/WeexWeiui/app/src/main/res/mipmap-xhdpi",
                "/platforms/android/WeexWeiui/app/src/main/res/mipmap-xxhdpi",
                "/platforms/android/WeexWeiui/app/src/main/res/mipmap-xxxhdpi",

                "/platforms/android/WeexWeiui/app/src/main/res/drawable-land-hdpi",
                "/platforms/android/WeexWeiui/app/src/main/res/drawable-land-ldpi",
                "/platforms/android/WeexWeiui/app/src/main/res/drawable-land-mdpi",
                "/platforms/android/WeexWeiui/app/src/main/res/drawable-land-xhdpi",
                "/platforms/android/WeexWeiui/app/src/main/res/drawable-land-xxhdpi",
                "/platforms/android/WeexWeiui/app/src/main/res/drawable-land-xxxhdpi",
                "/platforms/android/WeexWeiui/app/src/main/res/drawable-port-hdpi",
                "/platforms/android/WeexWeiui/app/src/main/res/drawable-port-ldpi",
                "/platforms/android/WeexWeiui/app/src/main/res/drawable-port-mdpi",
                "/platforms/android/WeexWeiui/app/src/main/res/drawable-port-xhdpi",
                "/platforms/android/WeexWeiui/app/src/main/res/drawable-port-xxhdpi",
                "/platforms/android/WeexWeiui/app/src/main/res/drawable-port-xxxhdpi",

                "/platforms/ios/WeexWeiui/WeexWeiui/Assets.xcassets/AppIcon.appiconset",
                "/platforms/ios/WeexWeiui/WeexWeiui/Assets.xcassets/LaunchImage.launchimage",

            ];
            for (let i = 0; i < dirLists.length; i++) {
                let lists = utils.fileDirDisplay(process.cwd() + dirLists[i]);
                for (let index in lists.dir) {
                    let tmp = lists.dir[index];
                    archive.directory(tmp, tmp.substr(count), null);
                }
                for (let index in lists.file) {
                    let tmp = lists.file[index];
                    archive.file(tmp, {name: tmp.substr(count)});
                }
            }
            let configPath = process.cwd() + "/weiui.config.js";
            archive.file(configPath, {name: configPath.substr(count) + ".bak"});
            //完成备份
            output.on('close', () => {
                if (typeof callback === "function") {
                    callback(true, zipPath);
                }else{
                    log.weiuis(`备份成功：${zipPath}`);
                }
            });
            archive.on('error', (err) => {
                if (typeof callback === "function") {
                    callback(false, err);
                }else{
                    log.fatal(`备份失败：${err}`);
                }
            });
            archive.pipe(output);
            archive.finalize();
        };
        if (typeof callback === "function") {
            startBack();
        } else {
            inquirer.prompt([{
                type: 'confirm',
                message: `确定备份项目开发文件吗？（含：页面、图标、启动页、weiui.config.js）`,
                name: 'ok',
            }]).then(answers => {
                if (answers.ok) {
                    startBack();
                } else {
                    log.fatal(`放弃备份！`);
                }
            }).catch(console.error);
        }
    },

    recovery() {
        let backupPath = path.resolve("common/backup");
        utils.mkdirsSync(backupPath);
        let count = utils.count(backupPath);
        let lists = utils.fileDirDisplay(backupPath, true);
        let choices = [];
        for (let index in lists.file) {
            let tmp = lists.file[index];
            choices.push(tmp.substr(count));
        }
        if (choices.length === 0) {
            log.fatal(`未找到备份文件！`);
        }
        let array = [{
            type: 'list',
            name: 'bakname',
            message: `请选择要恢复的备份文件：`,
            choices: choices.reverse()
        }];
        inquirer.prompt(array).then(function(answers) {
            inquirer.prompt([{
                type: 'confirm',
                message: `您确定恢复备份文件 ${answers.bakname} 吗？（注意：恢复备份可能会覆盖现有的文件）`,
                name: 'ok',
            }]).then(confirm => {
                if (confirm.ok) {
                    let zipFile = backupPath + "/" + answers.bakname;
                    if (!fs.existsSync(zipFile)) {
                        log.fatal(`恢复失败：备份文件 ${answers.bakname} 不存在！`);
                    }
                    backupMethod.recoveryHandler(zipFile, (res, msg) => {
                        if (res) {
                            log.weiuis(`恢复成功：${msg}`);
                        }else{
                            log.fatal(`恢复失败：${answers.bakname}！`);
                        }
                    });
                }
            }).catch(console.error);
        });
    },

    recoveryHandler(zipFile, callback) {
        fs.createReadStream(zipFile)
            .pipe(unzip2.Extract({ path: process.cwd() }))
            .on('error', function(err) {
                callback(false, err)
            })
            .on('finish', function() {
                let configPath = process.cwd() + '/weiui.config.js';
                let configBakPath = process.cwd() + '/weiui.config.js.bak';
                if (fs.existsSync(configBakPath)) {
                    let config = lodash.merge(require(configPath), require(configBakPath));
                    if (config !== null &&
                        typeof config === 'object' &&
                        typeof config.appKey !== 'undefined') {
                        let content = '';
                        content+= "/**\n * 配置文件\n * 参数详细说明：https://weiui.app/guide/config.html\n */\n";
                        content+= "module.exports = ";
                        content+= JSON.stringify(config, null, "\t");
                        content+= ";";
                        fs.writeFileSync(configPath, content, 'utf8');
                    }
                    setTimeout(() => {
                        fs.unlink(configBakPath, (err) => {
                            //删除备份配置文件(weiui.config.js.bak)成功
                        });
                    }, 200);
                }
                callback(true, null);
            });
    },
};

module.exports = backupMethod;
