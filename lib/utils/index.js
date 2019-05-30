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
        return 'https://console.weiui.app/api/';
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

    fileDirDisplay(filePath, currentDir) {
        let lists = {
            'dir': [],
            'file': [],
        };
        try {
            let stats = fs.statSync(filePath);
            if (stats.isFile()) {
                lists.file.push(filePath);
                return lists;
            }
        }catch (e) {
            return lists;
        }
        let files = fs.readdirSync(filePath);
        files.forEach((filename) => {
            let filedir = path.join(filePath, filename);
            let stats = fs.statSync(filedir);
            if (stats.isFile()) {
                if ([".DS_Store"].indexOf(filename) === -1) {
                    lists.file.push(filedir);
                }
            } else if (stats.isDirectory() && currentDir !== true) {
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

    replaceDictString(path, key, value) {
        if (!fs.existsSync(path)) {
            return;
        }
        let content = fs.readFileSync(path, 'utf8');
        let matchs = content.match(/<dict>(.*?)<\/dict>/gs);
        if (matchs) {
            matchs.forEach((oldText) => {
                oldText = oldText.substring(oldText.lastIndexOf('<dict>'), oldText.length);
                if (this.strExists(oldText, '<string>' + key + '</string>', true)) {
                    let searchValue = this.getMiddle(oldText, '<array>', '</array>');
                    if (searchValue) {
                        searchValue = '<array>' + searchValue + '</array>';
                        let stringValue = '<string>' + this.getMiddle(searchValue, '<string>', '</string>') + '</string>';
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
    },

    getQueryString: (search, name) => {
        let reg = new RegExp("(^|&|\\?)" + name + "=([^&]*)", "i");
        let r = search.match(reg);
        if (r != null) return (r[2]);
        return "";
    },

    removeRubbish(filePath) {
        let lists = {
            'dir': [],
            'file': [],
        };
        try {
            let files = fs.readdirSync(filePath);
            files.forEach((filename) => {
                let filedir = path.join(filePath, filename);
                let stats = fs.statSync(filedir);
                if (stats.isFile()) {
                    if ([".DS_Store"].indexOf(filename) === 0) {
                        fse.removeSync(filedir);
                        lists.file.push(filedir);
                    }
                } else if (stats.isDirectory()) {
                    if (["__MACOSX", "build"].indexOf(filename) === 0) {
                        fse.removeSync(filedir);
                        lists.dir.push(filedir);
                    }else{
                        this.removeRubbish(filedir);
                    }
                }
            });
            return lists;
        }catch (e) {
            return lists;
        }
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

    zeroFill(str, length, after) {
        str += "";
        if (str.length >= length) {
            return str;
        }
        let _str = '', _ret = '';
        for (let i = 0; i < length; i++) {
            _str += '0';
        }
        if (after || typeof after === 'undefined') {
            _ret = (_str + "" + str).substr(length * -1);
        } else {
            _ret = (str + "" + _str).substr(0, length);
        }
        return _ret;
    },

    formatDate(format, v) {
        if (format === '') {
            format = 'Y-m-d H:i:s';
        }
        if (typeof v === 'undefined') {
            v = new Date().getTime();
        } else if (/^(-)?\d{1,10}$/.test(v)) {
            v = v * 1000;
        } else if (/^(-)?\d{1,13}$/.test(v)) {
            v = v * 1000;
        } else if (/^(-)?\d{1,14}$/.test(v)) {
            v = v * 100;
        } else if (/^(-)?\d{1,15}$/.test(v)) {
            v = v * 10;
        } else if (/^(-)?\d{1,16}$/.test(v)) {
            v = v * 1;
        } else {
            return v;
        }
        let dateObj = new Date(v);
        if (parseInt(dateObj.getFullYear()) + "" === "NaN") {
            return v;
        }
        //
        format = format.replace(/Y/g, dateObj.getFullYear());
        format = format.replace(/m/g, this.zeroFill(dateObj.getMonth() + 1, 2));
        format = format.replace(/d/g, this.zeroFill(dateObj.getDate(), 2));
        format = format.replace(/H/g, this.zeroFill(dateObj.getHours(), 2));
        format = format.replace(/i/g, this.zeroFill(dateObj.getMinutes(), 2));
        format = format.replace(/s/g, this.zeroFill(dateObj.getSeconds(), 2));
        return format;
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
                    callback(data.data);
                }
            });
        }).catch(console.error);
    },

    logout(callback) {
        this.setToken("");
        if (typeof callback === "function") {
            callback();
        }
    },

    versionFunegt(Str1, Str2) {
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
    },

    verifyWeiuiProject() {
        //判断是否weiui项目
        let file = path.resolve(process.cwd(), "weiui.config.js");
        if (!fs.existsSync(file)) {
            log.error(`当前目录非weiui项目，无法进行此操作！`);
        }
        //判断weiui-cli版本需求
        file = path.resolve(process.cwd(), "package.json");
        if (fs.existsSync(file)) {
            let packageInfo = utils.jsonParse(fs.readFileSync(file, 'utf8'));
            let current = require('../../package.json').version;
            let weiuiclimin = packageInfo.weiuiclimin;
            if (utils.isHave(weiuiclimin) && utils.versionFunegt(weiuiclimin, current)) {
                log.error(`当前${chalk.underline(`weiui-cli@${current}`)}版本过低，无法进行此操作，请升级至${chalk.underline(`weiui-cli@${weiuiclimin}`)}或以上！`);
            }
        }
    },

    verifyWeiuiTemplate() {
        //判断是否新WeiuiApp模板
        let file = path.resolve(process.cwd(), "platforms/android/WeiuiApp/build.gradle");
        if (!fs.existsSync(file)) {
            log.error(`当前主程序版本过低，请先升级主程序！升级方法详见：${chalk.underline(`https://weiui.app/guide/update.html`)}`);
        }
    }
};

module.exports = utils;
