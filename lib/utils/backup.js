const fs = require('fs');
const inquirer = require('inquirer');
const archiver = require("archiver");
const unzip2 = require("unzip2");
const lodash = require("lodash");
const utils = require('../utils');
const log = require('../utils/logger');

const backupMethod = {
    backup() {
        inquirer.prompt([{
            type: 'confirm',
            message: `确定备份项目开发文件吗？（含：页面、图标、启动页、app.js、weiui.config.js）`,
            name: 'ok',
        }]).then(answers => {
            if (answers.ok) {
                let backupPath = process.cwd() + "/.backup/";
                utils.mkdirsSync(backupPath);
                let zipPath = backupPath + utils.formatDate("YmdHis") + ".zip";
                let output = fs.createWriteStream(zipPath);
                let count = utils.count(process.cwd());
                let archive = archiver('zip', null);
                //备份文件
                let dirLists = [
                    "/src",
                    "/statics/js/app.js",

                    "/platforms/android/WeexWeiui/app/src/main/res/mipmap-hdpi",
                    "/platforms/android/WeexWeiui/app/src/main/res/mipmap-mdpi",
                    "/platforms/android/WeexWeiui/app/src/main/res/mipmap-xhdpi",
                    "/platforms/android/WeexWeiui/app/src/main/res/mipmap-xxhdpi",
                    "/platforms/android/WeexWeiui/app/src/main/res/mipmap-xxxhdpi",

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
                    log.weiuis(`备份成功：${zipPath.replace(backupPath, '')}`);
                });
                archive.on('error', (err) => {
                    log.fatal(`备份失败：${err}`);
                });
                archive.pipe(output);
                archive.finalize();
            } else {
                log.fatal(`放弃备份！`);
            }
        }).catch(console.error);
    },

    recovery() {
        let backupPath = process.cwd() + "/.backup/";
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
            let zipFile = backupPath + answers.bakname;
            if (!fs.existsSync(zipFile)) {
                log.fatal(`恢复失败：备份文件 ${answers.bakname} 不存在！`);
            }
            fs.createReadStream(zipFile)
                .pipe(unzip2.Extract({ path: process.cwd() }))
                .on('error', function(err) {
                    log.fatal(`恢复失败：${err}！`);
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
                        }, 100);
                    }
                    log.weiuis(`恢复成功：${answers.bakname}`);
                });
        });
    },
};

module.exports = backupMethod;