#!/usr/bin/env node

const yargs = require("yargs");
const path = require("path");
const fs = require("fs-extra");
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const shelljs = require('shelljs');
const logger = require("./lib/utils/logger");
const runapp = require("./lib/run");
const plugin = require('./lib/plugin');

const TemplateRelease = require("./template-release");
const constants = require('./index').constants;
const templateRelease = new TemplateRelease(constants.cacheDirName, constants.templateReleaseUrl);

let questions = function(inputName, releaseLists) {
    let applicationid = "";
    let array = [{
        type: 'input',
        name: 'name',
        default: function() {
            if (typeof inputName !== 'string') inputName = "";
            return inputName.trim() ? inputName.trim() : 'weiui-demo';
        },
        message: "Project name",
        validate: function(value) {
            let pass = value.match(/^[0-9a-z\-_]+$/i);
            if (pass) {
                return true;
            }

            return 'Input format error, please re-enter.';
        }
    }, {
        type: 'list',
        name: 'release',
        message: "Template releases",
        choices: releaseLists
    }, {
        type: 'input',
        name: 'applicationID',
        default: function() {
            return 'cc.weiui.demo';
        },
        message: "Android application id",
        validate: function(value) {
            let pass = value.match(/^[a-zA-Z_][a-zA-Z0-9_]*[.][a-zA-Z_][a-zA-Z0-9_]*[.][a-zA-Z_][a-zA-Z0-9_]+$/);
            if (pass) {
                applicationid = value;
                return true;
            }
            return 'Input format error, please re-enter.';
        }
    }, {
        type: 'input',
        name: 'bundleIdentifier',
        default: function() {
            return applicationid;
        },
        message: "iOS Bundle Identifier",
        validate: function(value) {
            let pass = value.match(/^[a-zA-Z_][a-zA-Z0-9_]*[.][a-zA-Z_][a-zA-Z0-9_]*[.][a-zA-Z_][a-zA-Z0-9_]+$/);
            if (pass) {
                return true;
            }
            return 'Input format error, please re-enter.';
        }
    }];
    if (shelljs.which('pod')) {
        array.push({
            type: 'confirm',
            name: 'runpod',
            default: function() {
                return true;
            },
            message: "iOS project run pod install",
        });
    }
    return array;
};

let runQuestions = [{
    type: 'list',
    name: 'platform',
    message: 'You can install or update weiui sdk and librarys.',
    choices: [{
        name: "ios",
        value: "ios"
    }, {
        name: "android",
        value: "android"
    }
    ]
}];

/**
 * 创建 weiui 工程.
 */
function initProject(createName) {
    let spinFetch = ora('Downloading releases lists...');
    spinFetch.start();
    templateRelease.fetchReleaseVersions((err, result) => {
        spinFetch.stop();
        if (err) {
            logger.error(err);
            return;
        }
        //
        let lists = [];
        result.forEach(t => {
            if (lists.length === 0) {
                lists.push({
                    name: t + " (Latest)",
                    value: t
                });
            }else if (lists.length < 5) {
                lists.push({
                    name: t,
                    value: t
                });
            }
        });
        //
        if (lists.length === 0) {
            logger.error("No available releases was found.");
            return;
        }
        //
        inquirer.prompt(questions(createName, lists)).then(function(answers) {
            let _answers = JSON.parse(JSON.stringify(answers));
            let {name, release, applicationID, bundleIdentifier, runpod} = _answers;
            let rundir = path.resolve(process.cwd(), name);

            if (fs.existsSync(name)) {
                logger.error(`Directory [${name}] already exist.`);
                return;
            }

            templateRelease.fetchRelease(release === 'latest' ? '' : release, function(error, releasePath) {
                if (error) {
                    logger.error(error);
                    return;
                }

                logger.weiui("Copying template file...");
                fs.copySync(releasePath, name);

                if (applicationID !== 'cc.weiui.playground') {
                    let wxpayfile = rundir + '/plugins/android/weiui_pay/src/main/java/cc/weiui/playground/wxapi/WXPayEntryActivity.java';
                    let wxpaydir = rundir + '/plugins/android/weiui_pay/src/main/java/' + applicationID.replace(/\./g, '/') + '/wxapi/';
                    mkdirsSync(wxpaydir);
                    copyFile(wxpayfile, wxpaydir + 'WXPayEntryActivity.java');
                    changeFile(wxpaydir + 'WXPayEntryActivity.java', 'package cc.weiui.playground', 'package ' + applicationID);
                    changeFile(rundir + '/platforms/android/WeexWeiui/build.gradle', 'cc.weiui.playground', applicationID);
                    deleteAll(rundir + '/plugins/android/weiui_pay/src/main/java/cc/weiui/playground');
                }

                changeFile(rundir + '/platforms/ios/WeexWeiui/WeexWeiui.xcodeproj/project.pbxproj', 'PRODUCT_BUNDLE_IDENTIFIER = cc.weiui.playground;', 'PRODUCT_BUNDLE_IDENTIFIER = ' + bundleIdentifier + ';');
                changeFile(rundir + '/platforms/ios/WeexWeiui/WeexWeiui/Info.plist', 'weiuiApp_xxxxxxxx', 'weiuiApp' + replaceUpperCase(bundleIdentifier));
                changeFile(rundir + '/platforms/ios/WeexWeiui/WeexWeiui/Weiui/Moduld/WeiuiPayModule.m', 'weiuiApp_xxxxxxxx', 'weiuiApp' + replaceUpperCase(bundleIdentifier));

                changeAppKey(rundir);

                logger.sep();
                logger.weiui("Project created.");
                logger.sep();

                let finalLog = function(){
                    logger.weiui("Run flowing code to get started.");
                    logger.weiui(chalk.white(`1. cd ${name}`));
                    logger.weiui(chalk.white(`2. npm install`));
                    logger.weiui(chalk.white(`3. npm run serve`));
                };

                if (runpod === true) {
                    let spinPod = ora('Run pod install...');
                    spinPod.start();
                    shelljs.cd(rundir + '/platforms/ios/WeexWeiui');
                    shelljs.exec('pod install', {silent: true}, function(code, stdout, stderr){
                        spinPod.stop();
                        if (code !== 0) {
                            logger.warn("Run pod install error:" + code + ", please run manually later.");
                        }
                        finalLog();
                    });
                } else {
                    finalLog();
                }
            });
        });
    });
}

/**
 * 列出可用的模板版本
 */
function displayReleases() {
    logger.log("Fetching release info...");
    templateRelease.fetchReleaseVersions((err, result) => {
        if (err) {
            logger.error(err);
            return;
        }
        console.log("Available releases:");
        result.forEach(t => {
            console.log(chalk.green.underline(t));
        });
    })
}

/**
 * 递归创建目录 同步方法
 * @param dirname
 * @returns {boolean}
 */
function mkdirsSync(dirname) {
    if (fs.existsSync(dirname)) {
        return true;
    } else {
        if (mkdirsSync(path.dirname(dirname))) {
            fs.mkdirSync(dirname);
            return true;
        }
    }
}

/**
 * 复制文件
 * @param src
 * @param dist
 */
function copyFile(src, dist) {
    fs.writeFileSync(dist, fs.readFileSync(src));
}

/**
 * 删除目录
 * @param path
 */
function deleteAll(path) {
    let files = [];
    if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(function (file, index) {
            let curPath = path + "/" + file;
            if (fs.statSync(curPath).isDirectory()) {
                deleteAll(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

/**
 * 替换字符串
 * @param  {string} path 文件路径.
 * @param  {string} oldText
 * @param  {string} newText
 */
function changeFile(path, oldText, newText) {
    if (!fs.existsSync(path)) {
        return;
    }
    let result = fs.readFileSync(path, 'utf8').replace(new RegExp(oldText, "g"), newText);
    if (result) {
        fs.writeFileSync(path, result, 'utf8');
    }
}

/**
 * 生成appKey
 * @param  {string} path 文件路径.
 */
function changeAppKey(path) {
    let configPath =  path + "/weiui.config.js";
    if (!fs.existsSync(configPath)) {
        return;
    }
    let config = require(configPath);
    let content = '';
    if (config === null || typeof config !== 'object') {
        return;
    }
    if (typeof config.appKey === 'undefined') {
        return;
    }
    let createRand = function(len) {
        len = len || 32;
        let $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678oOLl9gqVvUuI1';
        let maxPos = $chars.length;
        let pwd = '';
        for (let i = 0; i < len; i++) {
            pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
        }
        return pwd;
    };
    logger.weiui("Create appKey...");
    config.appKey = createRand(32);
    content+= "/**\n * 配置文件\n * 参数详细说明：http://weiui.cc/#/start/config\n */\n";
    content+= "module.exports = ";
    content+= JSON.stringify(config, null, "\t");
    content+= ";";
    fs.writeFileSync(configPath, content, 'utf8');
    //
    let androidPath = path + "/platforms/android/WeexWeiui/app/src/main/assets/weiui/config.json";
    if (fs.existsSync(androidPath)) {
        fs.writeFileSync(androidPath, JSON.stringify(config), 'utf8');
    }
    let iosPath = path + "/platforms/ios/WeexWeiui/bundlejs/weiui/config.json";
    if (fs.existsSync(androidPath)) {
        fs.writeFileSync(iosPath, JSON.stringify(config), 'utf8');
    }
}

/**
 * 将点及后面的第一个字母换成大写字母，如：aaa.bbb.ccc换成AaaBbbCcc
 * @param string
 * @returns {*}
 */
function replaceUpperCase(string) {
    try {
        return string.replace(/^[a-z]/g, function ($1) {
            return $1.toLocaleUpperCase()
        }).replace(/\.+(\w)/g, function ($1) {
            return $1.toLocaleUpperCase()
        }).replace(/\./g, '');
    }catch (e) {
        return string;
    }
}

let args = yargs
    .command({
        command: ["create [name]", "init [name]"],
        desc: "Create a weiui project.",
        handler: function (argv) {
            if (typeof argv.name === "string") {
                if (fs.existsSync(argv.name)) {
                    logger.error(`Directory “${argv.name}” already exist.`);
                    return;
                }
            }
            initProject(argv.name);
        }
    })
    .command({
        command: "run [platform]",
        desc: "Run app in your device.",
        handler: function (argv) {
            let dir = path.basename(process.cwd());
            if (argv.platform  === "ios") {
                runapp.runIOS({dir});
            } else if (argv.platform  === "android") {
                runapp.runAndroid({dir});
            } else {
                inquirer.prompt(runQuestions).then(function(answers) {
                    let platform = JSON.parse(JSON.stringify(answers)).platform;
                    if (platform === 'ios') {
                        runapp.runIOS({dir});
                    }else if (platform === 'android') {
                        runapp.runAndroid({dir});
                    }
                });
            }
        }
    })
    .command({
        command: ["list", "lists"],
        desc: "List available template releases.",
        handler: function () {
            displayReleases();
        }
    })
    .command({
        command: "vue [pageName]",
        desc: "Create the vue page sample template.",
        handler: function (argv) {
            if (typeof argv.pageName === "string" && argv.pageName) {
                let dir = path.resolve(process.cwd(), "src");
                if (!fs.existsSync(dir)) {
                    logger.error(`Directory “src” does not exist.`);
                    return;
                }
                let filePath = dir + "/" + argv.pageName + ".vue";
                if (fs.existsSync(filePath)) {
                    logger.error(`File “${argv.pageName}.vue” already exist.`);
                    return;
                }
                let tmlPath = __dirname + "/lib/template/_template.vue";
                if (!fs.existsSync(tmlPath)) {
                    logger.error(`Template file does not exist.`);
                    return;
                }
                fs.copySync(tmlPath, filePath);
                logger.success(`File “${argv.pageName}.vue” created successfully.`);
            }
        }
    })
    .command({
        command: "plugin <command> <name>",
        desc: "Add or remove plugin.",
        handler: function (argv) {
            let op = {};
            op.name = argv.name;
            op.dir = path.basename(process.cwd());
            op.platform = "all";
            switch (argv.command) {
                case 'add':
                    plugin.add(op);
                    break;
                case 'remove':
                    plugin.remove(op);
                    break;
            }
        }
    })
    .version()
    .help()
    .alias({
        "h": "help",
        "v": "version"
    })
    .strict(true)
    .demandCommand()
    .argv;

//发布模块: npm publish
