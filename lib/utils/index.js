const fs = require("fs-extra");
const path = require("path");
const chalk = require('chalk');
const child_process = require('child_process');


const utils = {
    buildJS(cmd = 'build') {
        console.log(` => ${chalk.blue.bold('npm install&build')}`);
        return this.exec('npm install', true).then(() => {
            return this.exec('webpack --env.NODE_ENV=' + cmd);
        })
    },

    exec(command, quiet) {
        return new Promise((resolve, reject) => {
            try {
                let child = child_process.exec(command, {encoding: 'utf8'}, function () {
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
        if (fs.existsSync(dirname)) {
            return true;
        } else {
            if (this.mkdirsSync(path.dirname(dirname))) {
                fs.mkdirSync(dirname);
                return true;
            }
        }
    },
};

module.exports = utils;
