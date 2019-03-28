#!/usr/bin/env node

const yargs = require("yargs");
const path = require("path");
const fs = require("fs-extra");
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const shelljs = require('shelljs');
const utils = require("./lib/utils");
const logger = require("./lib/utils/logger");
const runapp = require("./lib/run");
const plugin = require('./lib/plugin');
const create = require('./lib/plugin/create');
const publish = require('./lib/plugin/publish');

const TemplateRelease = require("./template-release");
const constants = require('./index').constants;
const templateRelease = new TemplateRelease(constants.cacheDirName, constants.templateReleaseUrl);

let questions = function(inputName, releaseLists) {
    let applicationid = "";
    return [{
        type: 'input',
        name: 'name',
        default: function () {
            if (typeof inputName !== 'string') inputName = "";
            return inputName.trim() ? inputName.trim() : 'weiui-demo';
        },
        message: "请输入项目名称",
        validate: function (value) {
            let pass = value.match(/^[0-9a-z\-_]+$/i);
            if (pass) {
                return true;
            }

            return '输入格式错误，请重新输入。';
        }
    }, {
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
    }, {
        type: 'list',
        name: 'release',
        message: "请选择模板版本",
        choices: releaseLists
    }];
};

let runQuestions = [{
    type: 'list',
    name: 'platform',
    message: '您可以安装或更新Weiui SDK',
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
    let spinFetch = ora('正在下载版本列表...');
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
            logger.error("没有找到可用的版本。");
            return;
        }
        //
        inquirer.prompt(questions(createName, lists)).then(function(answers) {
            let _answers = JSON.parse(JSON.stringify(answers));
            let {name, appName, release, applicationID, bundleIdentifier} = _answers;
            let rundir = path.resolve(process.cwd(), name);

            if (fs.existsSync(name)) {
                logger.error(`目录[${name}]已经存在。`);
                return;
            }

            templateRelease.fetchRelease(release === 'latest' ? '' : release, function(error, releasePath) {
                if (error) {
                    logger.error(error);
                    return;
                }

                logger.weiui("正在复制模板文件...");
                fs.copySync(releasePath, name);

                changeFile(rundir + '/platforms/android/WeexWeiui/build.gradle', 'cc.weiui.playground', applicationID);
                changeFile(rundir + '/platforms/android/WeexWeiui/app/src/main/res/values/strings.xml', 'WeexWeiui', appName);

                changeFile(rundir + '/platforms/ios/WeexWeiui/WeexWeiui.xcodeproj/project.pbxproj', 'PRODUCT_BUNDLE_IDENTIFIER = cc.weiui.playground;', 'PRODUCT_BUNDLE_IDENTIFIER = ' + bundleIdentifier + ';');
                changeFile(rundir + '/platforms/ios/WeexWeiui/WeexWeiui/Info.plist', 'WeexWeiui', appName);
                replaceDictString(rundir + '/platforms/ios/WeexWeiui/WeexWeiui/Info.plist', 'weiuiAppName', 'weiuiApp' + replaceUpperCase(bundleIdentifier));

                changeAppKey(rundir);

                logger.sep();
                logger.weiui("创建项目完成。");
                logger.sep();

                let finalLog = function(){
                    logger.weiui("您可以运行一下命令开始。");
                    logger.weiui(chalk.white(`1. cd ${name}`));
                    logger.weiui(chalk.white(`2. npm install`));
                    logger.weiui(chalk.white(`3. npm run dev`));
                };

                if (shelljs.which('pod')) {
                    let spinPod = ora('正在运行pod安装...');
                    spinPod.start();
                    shelljs.cd(rundir + '/platforms/ios/WeexWeiui');
                    shelljs.exec('pod install', {silent: true}, function(code, stdout, stderr){
                        spinPod.stop();
                        if (code !== 0) {
                            logger.warn("运行pod安装错误:" + code + "，请稍后手动运行！");
                        }
                        finalLog();
                    });
                }else{
                    logger.warn('未检测到系统安装pod，请安装pod后手动执行pod install！');
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
    logger.log("正在获取版本信息...");
    templateRelease.fetchReleaseVersions((err, result) => {
        if (err) {
            logger.error(err);
            return;
        }
        console.log("可用的版本:");
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
 * 替换iOS plist文件项目内容
 * @param path
 * @param key
 * @param value
 */
function replaceDictString(path, key, value) {
    if (!fs.existsSync(path)) {
        return;
    }
    let content = fs.readFileSync(path, 'utf8');
    let matchs = content.match(/<dict>(.*?)<\/dict>/gs);
    if (matchs) {
        matchs.forEach(function (oldText) {
            oldText = oldText.substring(oldText.lastIndexOf('<dict>'), oldText.length);
            if (utils.strExists(oldText, '<string>' + key + '</string>', true)) {
                let searchValue = utils.getMiddle(oldText, '<array>', '</array>');
                if (searchValue) {
                    searchValue = '<array>' + searchValue + '</array>';
                    let stringValue = '<string>' + utils.getMiddle(searchValue, '<string>', '</string>') + '</string>';
                    let replaceValue = searchValue.replace(new RegExp(stringValue, "g"), '<string>' + value + '</string>');
                    let newText = oldText.replace(new RegExp(searchValue, "g"), replaceValue);
                    let result = fs.readFileSync(path, 'utf8').replace(new RegExp(oldText, "g"), newText);
                    if (result) {
                        fs.writeFileSync(path, result, 'utf8');
                    }
                }
            }
        });
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
    logger.weiui("正在创建appKey...");
    config.appKey = createRand(32);
    content+= "/**\n * 配置文件\n * 参数详细说明：https://weiui.app/guide/config.html\n */\n";
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
        command: "create [name]",
        desc: "创建一个weiui项目",
        handler: function (argv) {
            if (typeof argv.name === "string") {
                if (fs.existsSync(argv.name)) {
                    logger.error(`目录“${argv.name}”已经存在。`);
                    return;
                }
            }
            initProject(argv.name);
        }
    })
    .command({
        command: "lists",
        desc: "列出可用的模板版本",
        handler: function () {
            displayReleases();
        }
    })
    .command({
        command: "vue <pageName>",
        desc: "创建vue页面示例模板",
        handler: function (argv) {
            if (typeof argv.pageName === "string" && argv.pageName) {
                let dir = path.resolve(process.cwd(), "src");
                if (!fs.existsSync(dir)) {
                    logger.error(`目录“src”不存在。`);
                    return;
                }
                let filePath = dir + "/" + argv.pageName + ".vue";
                if (fs.existsSync(filePath)) {
                    logger.error(`文件“${argv.pageName}.vue”已经存在。`);
                    return;
                }
                let tmlPath = __dirname + "/lib/template/_template.vue";
                if (!fs.existsSync(tmlPath)) {
                    logger.error(`模板文件不存在。`);
                    return;
                }
                fs.copySync(tmlPath, filePath);
                logger.success(`模板文件“${argv.pageName}.vue”成功创建。`);
            }
        }
    })
    .command({
        command: "plugin <command> <name> [simple]",
        desc: "添加、删除、创建或发布插件",
        handler: function (argv) {
            let op = {};
            op.name = argv.name;
            op.dir = path.basename(process.cwd());
            op.simple = argv.simple === true;
            op.platform = "all";
            switch (argv.command) {
                case 'add':
                case 'install':
                case 'i':
                    plugin.add(op);
                    break;
                case 'remove':
                case 'uninstall':
                case 'un':
                    plugin.remove(op);
                    break;
                case 'create':
                    create.create(op);
                    break;
                case 'publish':
                    publish.publish(op);
                    break;
            }
        }
    })
    .command({
        command: "run [platform]",
        desc: "在你的设备上运行app(测试)",
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
    .version()
    .help()
    .alias({
        "h": "help",
        "v": "version",
        "s": "simple"
    })
    .strict(true)
    .demandCommand()
    .argv;

//发布模块: npm publish
