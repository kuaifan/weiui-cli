const android = require('./android');
const ios = require('./ios');
const net = require('../utils/net');
const log = require('../utils/logger');
const inquirer = require('inquirer');

const base = 'https://app.weiui.cc/api/app/';

function add(op) {
    getInfo(op, (res) => {
        switch (op.platform) {
            case 'all':
                if (res.ios_url !== '' && res.android_url !== '') {
                    op.callback = () => {
                        if (res.ios_url !== '') {
                            ios.add(op)
                        }
                    };
                    android.add(op)
                } else {
                    if (res.ios_url !== '') {
                        log.info('只检测到ios端插件，开始安装！');
                        ios.add(op)
                    }
                    if (res.android_url !== '') {
                        log.info('只检测到android端插件，开始安装！');
                        android.add(op)
                    }
                }
                break;

            case 'android':
                if (res.android_url !== '') {
                    android.add(op)
                } else {
                    log.fatal('未检测到android端插件，无法安装！')
                }
                break;

            case 'ios':
                if (res.ios_url !== '') {
                    ios.add(op)
                } else {
                    log.fatal('未检测到ios端插件，无法安装！')
                }
                break;
        }
    });
}

function remove(op) {
    inquirer.prompt([{
        type: 'confirm',
        message: `即将删除插件${op.name}，是否确定删除？`,
        name: 'ok',
    }]).then(answers => {
        if (answers.ok) {
            switch (op.platform) {
                case 'all':
                    op.myCallback = function() {
                        ios.remove(op);
                    };
                    android.remove(op);
                    break;

                case 'android':
                    android.remove(op);
                    break;

                case 'ios':
                    ios.remove(op);
                    break;
            }
        } else {
            log.fatal(`放弃删除${op.name}！`);
        }
    }).catch(console.error);
}


function getInfo(op, callback) {
    net.post(base + 'plugin', {name: op.name}, {}, (data) => {
        let res = JSON.parse(data);
        if (res.ret !== 1) {
            log.fatal(`获取插件失败：${res.msg}`);
        }
        let out = Object.assign(op, res.data);
        callback(out)
    });
}

module.exports = {add, remove, getInfo};