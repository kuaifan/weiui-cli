const fs = require('fs');
const fse = require("fs-extra");
const path = require('path');
const ora = require('ora');
const chalk = require('chalk');
const shelljs = require('shelljs');
const inquirer = require('inquirer');
const lodash = require("lodash");
const log = require('./logger');
const backup = require("./backup");
const utils = require("./index");
const project = require("./project");

const TemplateRelease = require("../../template-release");
const constants = require('../../index').constants;
const templateRelease = new TemplateRelease(constants.cacheDirName, constants.templateReleaseUrl);
const isWin = /^win/.test(process.platform);
const dirCut = isWin ? "\\" : "/";

const updateExpand = {
    androidGradle(name, newValue) {
        let file = process.cwd() + '/platforms/android/WeiuiApp/build.gradle';
        if (!fs.existsSync(file)) {
            file = process.cwd() + '/platforms/android/WeexWeiui/build.gradle';
        }
        if (!fs.existsSync(file)) {
            return "";
        }
        //
        let value = "";
        let result = fs.readFileSync(file, 'utf8');
        let reg = new RegExp(`${name}\\s*=\\s*("*|'*)(.+?)\\1\\n`);
        let match = result.match(reg);
        if (utils.count(match) > 2) {
            value = match[2].trim();
            if (typeof newValue !== "undefined") {
                let newResult = result.replace(new RegExp(match[0], "g"), `${name} = ${match[1]}${newValue}${match[1]}\n`);
                fs.writeFileSync(file, newResult, 'utf8');
                value = newValue;
            }
        }
        return value;
    },

    iosInfo(name, newValue) {
        let file = process.cwd() + '/platforms/ios/WeiuiApp/WeiuiApp/Info.plist';
        if (!fs.existsSync(file)) {
            file = process.cwd() + '/platforms/ios/WeexWeiui/WeexWeiui/Info.plist';
        }
        if (!fs.existsSync(file)) return "";
        //
        let value = "";
        let result = fs.readFileSync(file, 'utf8');
        let reg = new RegExp(`<key>${name}</key>(\\s*\\n*\\s*)<string>(.+?)</string>`);
        let match = result.match(reg);
        if (utils.count(match) > 2) {
            value = match[2].trim();
            if (typeof newValue !== "undefined") {
                let newResult = result.replace(new RegExp(match[0], "g"), `<key>${name}</key>${match[1]}<string>${newValue}</string>`);
                fs.writeFileSync(file, newResult, 'utf8');
                value = newValue;
            }
        }
        return value;
    }
};

function start() {
    let projectPath = path.resolve(process.cwd());
    let configFile = projectPath + dirCut + "weiui.config.js";
    if (!fs.existsSync(configFile)) {
        log.fatal("当前目录非weiui项目，无法进行升级操作！");
    }
    let releaseFile = projectPath + dirCut + ".weiui.release";
    let releaseConfig = utils.jsonParse(!fs.existsSync(releaseFile) ? {} : fs.readFileSync(releaseFile, 'utf8'));
    //
    let appRelease = releaseConfig.release;
    let newRelease = '';
    let spinFetch = ora('正在获取版本列表...');
    spinFetch.start();
    templateRelease.fetchReleaseVersions((err, result) => {
        spinFetch.stop();
        if (err) {
            log.fatal(err);
        }
        newRelease = result[0];
        if (!utils.versionFunegt(newRelease, appRelease)) {
            log.weiuis(`当前版本（${appRelease}）已是最新版本。`);
            return;
        }
        //
        let questions = [{
            type: 'confirm',
            message: `确定开始升级主框架吗？（${appRelease} -> ${newRelease}）`,
            name: 'ok',
        }];
        if (!utils.isHave(releaseConfig.release)) {
            let applicationid = "";
            questions.push({
                type: 'input',
                name: 'appName',
                default: function () {
                    return 'Weiui演示';
                },
                message: "请输入app名称",
                validate: function (value) {
                    return value !== ''
                }
            }, {
                type: 'input',
                name: 'applicationID',
                default: function () {
                    return 'cc.weiui.demo';
                },
                message: "请输入Android应用ID",
                validate: function (value) {
                    let pass = value.match(/^[a-zA-Z_][a-zA-Z0-9_]*[.][a-zA-Z_][a-zA-Z0-9_]*[.][a-zA-Z_][a-zA-Z0-9_]+$/);
                    if (pass) {
                        applicationid = value;
                        return true;
                    }
                    return '输入格式错误，请重新输入。';
                }
            }, {
                type: 'input',
                name: 'bundleIdentifier',
                default: function () {
                    return applicationid;
                },
                message: "请输入iOS应用Bundle ID",
                validate: function (value) {
                    let pass = value.match(/^[a-zA-Z_][a-zA-Z0-9_]*[.][a-zA-Z_][a-zA-Z0-9_]*[.][a-zA-Z_][a-zA-Z0-9_]+$/);
                    if (pass) {
                        return true;
                    }
                    return '输入格式错误，请重新输入。';
                }
            });
        }
        inquirer.prompt(questions).then(answers => {
            if (answers.ok) {
                log.weiui(`开始升级至：${newRelease}`);
                let originalData = {
                    android: {
                        versionCode: updateExpand.androidGradle("versionCode"),
                        versionName: updateExpand.androidGradle("versionName"),
                    },
                    ios: {
                        CFBundleVersion: updateExpand.iosInfo("CFBundleVersion"),
                        CFBundleShortVersionString: updateExpand.iosInfo("CFBundleShortVersionString"),
                    }
                };
                if (!utils.isHave(releaseConfig.release)) {
                    releaseConfig = lodash.merge(releaseConfig, answers);
                }
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
                                //
                                releaseConfig.release = newRelease;
                                project.initConfig(projectPath, releaseConfig);
                                updateExpand.androidGradle("versionCode", originalData.android.versionCode);
                                updateExpand.androidGradle("versionName", originalData.android.versionName);
                                updateExpand.iosInfo("CFBundleVersion", originalData.ios.CFBundleVersion);
                                updateExpand.iosInfo("CFBundleShortVersionString", originalData.ios.CFBundleShortVersionString);
                                //
                                let finalLog = () => {
                                    log.weiuis(`主框架升级至最新版本（${newRelease}）成功。`);
                                    log.sep();
                                    log.weiui("您可以运行一下命令开始。");
                                    log.weiui(chalk.white(`1. npm install`));
                                    log.weiui(chalk.white(`2. npm run dev`));
                                };
                                if (shelljs.which('pod')) {
                                    let spinPod = ora('正在运行pod install...');
                                    spinPod.start();
                                    shelljs.cd(projectPath + '/platforms/ios/WeiuiApp');
                                    shelljs.exec('pod install', {silent: true}, function (code, stdout, stderr) {
                                        spinPod.stop();
                                        if (code !== 0) {
                                            log.warn("运行pod install错误:" + code + "，请稍后手动运行！");
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

module.exports = {start};
