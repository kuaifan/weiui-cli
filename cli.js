#!/usr/bin/env node

const yargs = require("yargs");
const path = require("path");
const fse = require("fs-extra");
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const shelljs = require('shelljs');
const logger = require("./lib/utils/logger");
const utils = require("./lib/utils");
const project = require("./lib/utils/project");
const backup = require("./lib/utils/backup");
const runapp = require("./lib/run");
const builder = require("./lib/builder");
const plugin = require('./lib/plugin');
const create = require('./lib/plugin/create');
const publish = require('./lib/plugin/publish');
const update = require('./lib/utils/update');

const TemplateRelease = require("./template-release");
const constants = require('./index').constants;
const templateRelease = new TemplateRelease(constants.cacheDirName, constants.templateReleaseUrl);
const isWin = /^win/.test(process.platform);

let questions = (inputName, releaseLists) => {
    let applicationid = "";
    return [{
        type: 'input',
        name: 'name',
        default: () => {
            if (typeof inputName !== 'string') inputName = "";
            return inputName.trim() ? inputName.trim() : 'weiui-demo';
        },
        message: "请输入项目名称",
        validate: (value) => {
            let pass = value.match(/^[0-9a-z\-_]+$/i);
            if (pass) {
                return true;
            }
            return '输入格式错误，请重新输入。';
        }
    }, {
        type: 'input',
        name: 'appName',
        default: () => {
            return 'Weiui演示';
        },
        message: "请输入app名称",
        validate: (value) => {
            return value !== ''
        }
    }, {
        type: 'input',
        name: 'applicationID',
        default: () => {
            return 'cc.weiui.demo';
        },
        message: "请输入Android应用ID",
        validate: (value) => {
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
        default: () => {
            return applicationid;
        },
        message: "请输入iOS应用Bundle ID",
        validate: (value) => {
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
    }]
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
            } else if (lists.length < 5) {
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
        inquirer.prompt(questions(createName, lists)).then((answers) => {
            let _answers = JSON.parse(JSON.stringify(answers));
            let rundir = path.resolve(process.cwd(), _answers.name);

            if (fse.existsSync(_answers.name)) {
                logger.error(`目录[${_answers.name}]已经存在。`);
                return;
            }

            let release = _answers.release === 'latest' ? '' : _answers.release;
            templateRelease.fetchRelease(release, (error, releasePath) => {
                if (error) {
                    logger.error(error);
                    return;
                }

                logger.weiui("正在复制模板文件...");

                fse.copySync(releasePath, _answers.name);
                project.initConfig(rundir, _answers);
                changeAppKey(rundir);

                let finalLog = () => {
                    logger.weiuis("创建项目完成。");
                    logger.sep();
                    logger.weiui("您可以运行一下命令开始。");
                    logger.weiui(chalk.white(`1. cd ${_answers.name}`));
                    logger.weiui(chalk.white(`2. npm install`));
                    logger.weiui(chalk.white(`3. npm run dev`));
                };

                if (shelljs.which('pod')) {
                    let spinPod = ora('正在运行pod install...');
                    spinPod.start();
                    shelljs.cd(rundir + '/platforms/ios/WeiuiApp');
                    shelljs.exec('pod install', {silent: true}, (code, stdout, stderr) => {
                        spinPod.stop();
                        if (code !== 0) {
                            logger.warn("运行pod install错误:" + code + "，请稍后手动运行！");
                        }
                        finalLog();
                    });
                } else {
                    if (isWin) {
                        logger.warn('未检测到系统安装pod，请安装pod后手动执行pod install！');
                    }
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
    logger.info("正在获取版本信息...");
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
 * 生成appKey
 * @param  {string} path 文件路径.
 */
function changeAppKey(path) {
    let configPath = path + "/weiui.config.js";
    if (!fse.existsSync(configPath)) {
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
    let createRand = (len) => {
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
    content += "/**\n * 配置文件\n * 参数详细说明：https://weiui.app/guide/config.html\n */\n";
    content += "module.exports = ";
    content += JSON.stringify(config, null, "\t");
    content += ";";
    fse.writeFileSync(configPath, content, 'utf8');
    //
    let androidPath = path + "/platforms/android/WeiuiApp/app/src/main/assets/weiui/config.json";
    if (fse.existsSync(androidPath)) {
        fse.writeFileSync(androidPath, JSON.stringify(config), 'utf8');
    }
    let iosPath = path + "/platforms/ios/WeiuiApp/bundlejs/weiui/config.json";
    if (fse.existsSync(androidPath)) {
        fse.writeFileSync(iosPath, JSON.stringify(config), 'utf8');
    }
}

let args = yargs
    .command({
        command: "create [name]",
        desc: "创建一个weiui项目",
        handler: (argv) => {
            if (typeof argv.name === "string") {
                if (fse.existsSync(argv.name)) {
                    logger.error(`目录“${argv.name}”已经存在。`);
                    return;
                }
            }
            initProject(argv.name);
        }
    })
    .command({
        command: "update",
        desc: "项目主框架升级至最新版本",
        handler: () => {
            utils.verifyWeiuiProject();
            update.start();
        }
    })
    .command({
        command: "lists",
        desc: "列出可用的模板版本",
        handler: () => {
            displayReleases();
        }
    })
    .command({
        command: "vue <pageName>",
        desc: "创建vue页面示例模板",
        handler: (argv) => {
            utils.verifyWeiuiProject();
            utils.verifyWeiuiTemplate();
            if (typeof argv.pageName === "string" && argv.pageName) {
                let dir = path.resolve(process.cwd(), "src");
                if (!fse.existsSync(dir)) {
                    logger.error(`目录“src”不存在，当前目录非weiui项目。`);
                    return;
                }
                let filePath = dir + "/pages/" + argv.pageName + ".vue";
                if (fse.existsSync(filePath)) {
                    logger.error(`文件“${argv.pageName}.vue”已经存在。`);
                    return;
                }
                let tmlPath = __dirname + "/lib/template/_template.vue";
                if (!fse.existsSync(tmlPath)) {
                    logger.error(`模板文件不存在。`);
                    return;
                }
                fse.copySync(tmlPath, filePath);
                logger.success(`模板文件“${argv.pageName}.vue”成功创建。`);
            }
        }
    })
    .command({
        command: "plugin <command> <name> [simple]",
        desc: "添加、删除、创建或发布插件",
        handler: (argv) => {
            utils.verifyWeiuiProject();
            utils.verifyWeiuiTemplate();
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
        command: "login",
        desc: "登录云中心",
        handler: () => {
            utils.login((data) => {
                logger.weiuis(data.username + ' 登录成功！');
            });
        }
    })
    .command({
        command: "logout",
        desc: "登出云中心",
        handler: () => {
            utils.logout(() => {
                logger.weiuis('退出成功！');
            });
        }
    })
    .command({
        command: "backup",
        desc: "备份项目开发文件",
        handler: () => {
            utils.verifyWeiuiProject();
            backup.backup();
        }
    })
    .command({
        command: "recovery",
        desc: "恢复项目备份文件",
        handler: () => {
            utils.verifyWeiuiProject();
            utils.verifyWeiuiTemplate();
            backup.recovery();
        }
    })
    .command({
        command: "dev",
        desc: "调试开发",
        handler: () => {
            utils.verifyWeiuiProject();
            utils.verifyWeiuiTemplate();
            builder.dev();
        }
    })
    .command({
        command: "build",
        desc: "编译构造",
        handler: () => {
            utils.verifyWeiuiProject();
            utils.verifyWeiuiTemplate();
            builder.build();
        }
    })
    .command({
        command: "run [platform]",
        desc: "在你的设备上运行app (实验功能)",
        handler: (argv) => {
            utils.verifyWeiuiProject();
            utils.verifyWeiuiTemplate();
            let dir = path.basename(process.cwd());
            if (argv.platform === "ios") {
                runapp.runIOS({dir});
            } else if (argv.platform === "android") {
                runapp.runAndroid({dir});
            } else {
                inquirer.prompt(runQuestions).then((answers) => {
                    let platform = JSON.parse(JSON.stringify(answers)).platform;
                    if (platform === 'ios') {
                        runapp.runIOS({dir});
                    } else if (platform === 'android') {
                        runapp.runAndroid({dir});
                    }
                });
            }
        }
    })
    .version(require('./package.json').version)
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
