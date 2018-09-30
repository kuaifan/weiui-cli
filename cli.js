#!/usr/bin/env node

const yargs = require("yargs");
const path = require("path");
const fs = require("fs-extra");
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const shelljs = require('shelljs');
const logger = require("./logger");

const TemplateRelease = require("./template-release");
const constants = require('./index').constants;
const templateRelease = new TemplateRelease(constants.cacheDirName, constants.templateReleaseUrl);

let questions = function(inputName, releaseLists) {
    let array = [{
        type: 'input',
        name: 'name',
        default: function() {
            if (typeof inputName != 'string') inputName = "";
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
            if (lists.length == 0) {
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
        if (lists.length == 0) {
            logger.error("No available releases was found.");
            return;
        }
        //
        inquirer.prompt(questions(createName, lists)).then(function(answers) {
            let _answers = JSON.parse(JSON.stringify(answers));
            let {name, release, applicationID, runpod} = _answers;
            let rundir = path.resolve(process.cwd(), name);

            if (fs.existsSync(name)) {
                logger.error(`Directory [${name}] already exist.`);
                return;
            }

            templateRelease.fetchRelease(release == 'latest' ? '' : release, function(error, releasePath) {
                if (error) {
                    logger.error(error);
                    return;
                }

                logger.weiui("Copying template file...");
                fs.copySync(releasePath, name);

                changeFile(rundir + '/platforms/android/WeexWeiui/build.gradle', 'cc.weiui.playground', applicationID);
                changeAppKey(rundir + "/weiui.config.js");

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
    if (!fs.existsSync(path)) {
        return;
    }
    let config = require(path);
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
    fs.writeFileSync(path, content, 'utf8');
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
        command: ["list", "lists"],
        desc: "List available template releases.",
        handler: function () {
            displayReleases();
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
