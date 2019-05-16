const fs = require('fs');
const fse = require("fs-extra");
const path = require('path');
const ora = require('ora');
const chalk = require('chalk');
const shelljs = require('shelljs');
const inquirer = require('inquirer');
const log = require('./logger');
const backup = require("./backup");

const TemplateRelease = require("../../template-release");
const constants = require('../../index').constants;
const templateRelease = new TemplateRelease(constants.cacheDirName, constants.templateReleaseUrl);
const isWin = /^win/.test(process.platform);
const dirCut = isWin ? "\\" : "/";

function start() {
    let projectPath = path.resolve(process.cwd());
    let configFile = projectPath + dirCut + "weiui.config.js";
    let releaseFile = projectPath + dirCut + ".weiui.release";
    if (!fs.existsSync(configFile)) {
        log.fatal("当前目录非weiui项目，无法进行升级操作！");
    }
    //
    let appRelease = !fs.existsSync(releaseFile) ? "undefined" : fs.readFileSync(releaseFile, 'utf8');
    let newRelease = '';
    let spinFetch = ora('正在获取版本列表...');
    spinFetch.start();
    templateRelease.fetchReleaseVersions((err, result) => {
        spinFetch.stop();
        if (err) {
            log.fatal(err);
        }
        newRelease = result[0];
        if (!versionFunegt(newRelease, appRelease)) {
            log.weiuis(`当前版本（${appRelease}）已是最新版本。`);
            return;
        }
        inquirer.prompt([{
            type: 'confirm',
            message: `确定开始升级主框架吗？（${appRelease} -> ${newRelease}）`,
            name: 'ok',
        }]).then(answers => {
            if (answers.ok) {
                log.weiui(`开始升级至：${newRelease}`);
                templateRelease.fetchRelease(newRelease, function (error, releasePath) {
                    if (error) {
                        log.fatal(error);
                    }
                    log.weiui(`备份项目开发文件...`);
                    backup.backup((ret, backPath) => {
                        if (!ret) {
                            log.fatal(`备份失败：${backPath}`);
                        }
                        log.weiui(`备份成功`);
                        log.weiui(`升级新版本文件...`);
                        fse.copy(releasePath, projectPath).then(() => {
                            log.weiui(`升级成功`);
                            log.weiui(`恢复项目开发文件...`);
                            backup.recoveryHandler(backPath, (rec, msg) => {
                                if (!rec) {
                                    log.fatal(`恢复失败：${msg}`);
                                }
                                log.weiui(`恢复成功`);
                                let finalLog = () => {
                                    fs.writeFileSync(releaseFile, newRelease, 'utf8');
                                    log.weiuis(`主框架升级至最新版本（${newRelease}）成功。`);
                                    log.sep();
                                    log.weiui("您可以运行一下命令开始。");
                                    log.weiui(chalk.white(`1. npm install`));
                                    log.weiui(chalk.white(`2. npm run dev`));
                                };
                                if (shelljs.which('pod')) {
                                    let spinPod = ora('正在运行pod安装...');
                                    spinPod.start();
                                    shelljs.cd(projectPath + '/platforms/ios/WeexWeiui');
                                    shelljs.exec('pod install', {silent: true}, function (code, stdout, stderr) {
                                        spinPod.stop();
                                        if (code !== 0) {
                                            log.warn("运行pod安装错误:" + code + "，请稍后手动运行！");
                                        }
                                        finalLog();
                                    });
                                } else {
                                    if (isWin) {
                                        log.warn('未检测到系统安装pod，请安装pod后手动执行pod install！');
                                    }
                                    finalLog();
                                }
                            });
                        }).catch(err => {
                            log.fatal(`升级新版本文件失败：${err}`);
                        });
                    });
                });
            } else {
                log.fatal(`放弃升级！`);
            }
        }).catch(console.error);
    });
}

function versionFunegt(Str1, Str2) {
    let nStr1 = (Str1 + "").replace(/(^\s+)|(\s+$)/gi, "");
    let nStr2 = (Str2 + "").replace(/(^\s+)|(\s+$)/gi, "");
    if (!nStr1 || !nStr2) {
        return true;
    }
    try {
        let req = /\d(\.|\d)*\d/gi;
        nStr1 = nStr1.match(req)[0];
        nStr2 = nStr2.match(req)[0];
        let arr1 = nStr1.split('.');
        let arr2 = nStr2.split('.');
        let minL = Math.min(arr1.length, arr2.length);
        let index = 0;
        let diff = 0;
        while (index < minL) {
            diff = parseInt(arr1[index]) - parseInt(arr2[index]);
            if (diff !== 0) {
                break;
            }
            index++;
        }
        diff = (diff !== 0) ? diff : (arr1.length - arr2.length);
        return diff > 0;
    }catch (e) {
        return true;
    }
}

module.exports = {start};
