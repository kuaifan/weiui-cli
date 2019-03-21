const fs = require('fs');
const fse = require("fs-extra");
const path = require("path");
const chalk = require('chalk');
const child_process = require('child_process');
const inquirer = require('inquirer');
const ora = require('ora');
const request = require('request');
const log = require('../utils/logger');


const utils = {
    apiUrl() {
        return 'https://app.weiui.cc/api/';
    },

    buildJS(cmd = 'build') {
        console.log(` => ${chalk.blue.bold('npm install&build')}`);
        return this.exec('npm install', true).then(() => {
            return this.exec('webpack --env.NODE_ENV=' + cmd);
        })
    },

    exec(command, quiet) {
        return new Promise((resolve, reject) => {
            try {
                let child = child_process.exec(command, {encoding: 'utf8'}, () => {
                    resolve();
                });
                if (!quiet) {
                    child.stdout.pipe(process.stdout);
                }
                child.stderr.pipe(process.stderr);
            } catch (e) {
                console.error('execute command failed :', command);
                reject(e);
            }
        })
    },

    parseDevicesResult(result) {
        if (!result) {
            return [];
        }
        const devices = [];
        const lines = result.trim().split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            let words = lines[i].split(/[ ,\t]+/).filter((w) => w !== '');

            if (words[1] === 'device') {
                devices.push(words[0]);
            }
        }
        return devices;
    },

    mkdirsSync(dirname) {
        if (fse.existsSync(dirname)) {
            return true;
        } else {
            if (this.mkdirsSync(path.dirname(dirname))) {
                fse.mkdirSync(dirname);
                return true;
            }
        }
    },

    getMiddle(string, start, end) {
        if (this.isHave(start) && this.strExists(string, start)) {
            string = string.substring(string.indexOf(start) + start.length);
        } else {
            return "";
        }
        if (this.isHave(end) && this.strExists(string, end)) {
            string = string.substring(0, string.indexOf(end));
        } else {
            return "";
        }
        return string;
    },

    isHave(set) {
        return !!(set !== null && set !== "null" && set !== undefined && set !== "undefined" && set);
    },

    strExists(string, find, lower) {
        string += "";
        find += "";
        if (lower !== true) {
            string = string.toLowerCase();
            find = find.toLowerCase();
        }
        return (string.indexOf(find) !== -1);
    },

    isNullOrUndefined(obj) {
        return typeof obj === "undefined" || obj === null;
    },

    likeArray(obj) {
        return this.isNullOrUndefined(obj) ? false : typeof obj.length === 'number';
    },

    count(obj) {
        try {
            if (typeof obj === "undefined") {
                return 0;
            }
            if (typeof obj === "number") {
                obj+= "";
            }
            if (typeof obj.length === 'number') {
                return obj.length;
            } else {
                let i = 0, key;
                for (key in obj) {
                    i++;
                }
                return i;
            }
        }catch (e) {
            return 0;
        }
    },

    each(elements, callback) {
        let i, key;
        if (this.likeArray(elements)) {
            if (typeof elements.length === "number") {
                for (i = 0; i < elements.length; i++) {
                    if (callback.call(elements[i], i, elements[i]) === false) return elements
                }
            }
        } else {
            for (key in elements) {
                if (!elements.hasOwnProperty(key)) continue;
                if (callback.call(elements[key], key, elements[key]) === false) return elements
            }
        }

        return elements
    },

    getObject(obj, keys) {
        let object = obj;
        if (this.count(obj) === 0 || this.count(keys) === 0) {
            return "";
        }
        let arr = keys.replace(/,/g, "|").replace(/\./g, "|").split("|");
        this.each(arr, (index, key) => {
            object = typeof object[key] === "undefined" ? "" : object[key];
        });
        return object;
    },

    fileDirDisplay(filePath) {
        let lists = {
            'dir': [],
            'file': [],
        };
        let files = fs.readdirSync(filePath);
        files.forEach((filename) => {
            let filedir = path.join(filePath, filename);
            let stats = fs.statSync(filedir);
            if (stats.isFile()) {
                if ([".DS_Store"].indexOf(filename) === -1) {
                    lists.file.push(filedir);
                }
            } else if (stats.isDirectory()) {
                if (["__MACOSX", "build"].indexOf(filename) === -1) {
                    lists.dir.push(filedir);
                    let tmps = this.fileDirDisplay(filedir);
                    lists.dir = lists.dir.concat(tmps.dir);
                    lists.file = lists.file.concat(tmps.file);
                }
            }
        });
        return lists;
    },

    jsonParse(str, defaultVal) {
        try{
            return JSON.parse(str);
        }catch (e) {
            return defaultVal ? defaultVal : {};
        }
    },

    jsonStringify(json, defaultVal) {
        try{
            return JSON.stringify(json);
        }catch (e) {
            return defaultVal ? defaultVal : "";
        }
    },

    setToken(token) {
        let cachePath = __dirname + '/.cache';
        fse.ensureFileSync(cachePath);
        let cache = this.jsonParse(fs.readFileSync(cachePath, 'utf8'));
        cache.token = token;
        fs.writeFileSync(cachePath, this.jsonStringify(cache), 'utf8');
    },

    getToken() {
        let cachePath = __dirname + '/.cache';
        fse.ensureFileSync(cachePath);
        let cache = this.jsonParse(fs.readFileSync(cachePath, 'utf8'));
        return this.getObject(cache, 'token');
    },

    login(callback) {
        inquirer.prompt([{
            type: 'input',
            name: 'userphone',
            message: "请输入登录手机号：",
        }, {
            type: 'password',
            name: 'userpass',
            message: "请输入登录密码：",
        }]).then((answers) => {
            let spinFetch = ora('正在登录...').start();
            request(this.apiUrl() + 'users/login?userphone=' + answers.userphone + "&userpass=" + answers.userpass, (err, res, body) => {
                spinFetch.stop();
                let data = this.jsonParse(body);
                if (data.ret !== 1) {
                    log.fatal(`登录失败：${data.msg}`);
                }
                this.setToken(data.data.token);
                //
                if (typeof callback === "function") {
                    callback();
                }
            });
        }).catch(console.error);
    },
};

module.exports = utils;
